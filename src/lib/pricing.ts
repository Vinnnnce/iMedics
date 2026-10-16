import type { ConsultationFeeKind, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

type Db = PrismaClient | Prisma.TransactionClient;

const MS_PER_DAY = 86_400_000;

export interface ConsultationFee {
  /** False until the doctor publishes a fee (0 is a valid "free" fee). Booking is blocked while false. */
  configured: boolean;
  kind: ConsultationFeeKind;
  amount: number;
  currency: string;
  standardAmount: number;
  /** The doctor's separate follow-up fee, if they set one. */
  followUpAmount: number | null;
  followUpWindowDays: number;
  /** Set when this patient qualifies for the follow-up rate for the requested time. */
  qualifyingAppointmentId: string | null;
  qualifiesUntil: Date | null;
  /** Set when the fee comes from a specific service in the doctor's catalogue. */
  serviceName: string | null;
  serviceDurationMinutes: number | null;
}

/**
 * The fee a patient pays a doctor for an appointment at `at`.
 *
 * A booking is charged the follow-up fee when the patient had a COMPLETED *standard* consultation with the same
 * doctor within the doctor's follow-up window before `at`. Only standard visits start a window, so follow-ups
 * cannot be chained indefinitely. Without a separate follow-up fee, the standard fee always applies.
 *
 * When `serviceId` is given, the same rule prices that service instead: its own price and follow-up price (with
 * its own eligibility window, falling back to the doctor's). The service must belong to this doctor and be
 * active; the doctor's own published fee remains the fallback for bookings without a service.
 */
export async function resolveConsultationFee(
  doctorId: string,
  patientId: string | null,
  at: Date,
  db: Db = prisma,
  serviceId?: string | null,
): Promise<ConsultationFee> {
  const doctor = await db.doctorProfile.findUniqueOrThrow({
    where: { id: doctorId },
    select: { consultationFee: true, followUpFee: true, followUpWindowDays: true, currency: true },
  });

  let service: { name: string; price: unknown; followUpPrice: unknown; followUpWindowDays: number | null; durationMinutes: number; isActive: boolean } | null = null;
  if (serviceId) {
    const found = await db.doctorService.findUnique({
      where: { id: serviceId },
      select: { doctorId: true, isActive: true, name: true, price: true, followUpPrice: true, followUpWindowDays: true, durationMinutes: true },
    });
    if (!found || found.doctorId !== doctorId || !found.isActive) throw new Error("Service is not available");
    service = found;
  }

  const standard = service ? Number(service.price) : doctor.consultationFee === null ? 0 : Number(doctor.consultationFee);
  const followUp = service
    ? service.followUpPrice === null
      ? null
      : Number(service.followUpPrice)
    : doctor.followUpFee === null
      ? null
      : Number(doctor.followUpFee);
  const windowDays = service?.followUpWindowDays ?? doctor.followUpWindowDays;

  let qualifying: { id: string; scheduledAt: Date } | null = null;
  if (patientId && followUp !== null && windowDays > 0) {
    qualifying = await db.appointment.findFirst({
      where: {
        doctorId,
        patientId,
        status: "COMPLETED",
        feeKind: "STANDARD",
        scheduledAt: { gte: new Date(at.getTime() - windowDays * MS_PER_DAY), lt: at },
      },
      orderBy: { scheduledAt: "desc" },
      select: { id: true, scheduledAt: true },
    });
  }

  const isFollowUp = qualifying !== null && followUp !== null;
  return {
    configured: service ? true : doctor.consultationFee !== null,
    kind: isFollowUp ? "FOLLOW_UP" : "STANDARD",
    amount: isFollowUp ? followUp : standard,
    currency: doctor.currency,
    standardAmount: standard,
    followUpAmount: followUp,
    followUpWindowDays: windowDays,
    qualifyingAppointmentId: qualifying?.id ?? null,
    qualifiesUntil: qualifying ? new Date(qualifying.scheduledAt.getTime() + windowDays * MS_PER_DAY) : null,
    serviceName: service?.name ?? null,
    serviceDurationMinutes: service?.durationMinutes ?? null,
  };
}
