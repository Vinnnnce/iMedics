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
}

/**
 * The fee a patient pays a doctor for an appointment at `at`.
 *
 * A booking is charged the follow-up fee when the patient had a COMPLETED *standard* consultation with the same
 * doctor within the doctor's follow-up window before `at`. Only standard visits start a window, so follow-ups
 * cannot be chained indefinitely. Without a separate follow-up fee, the standard fee always applies.
 */
export async function resolveConsultationFee(
  doctorId: string,
  patientId: string | null,
  at: Date,
  db: Db = prisma,
): Promise<ConsultationFee> {
  const doctor = await db.doctorProfile.findUniqueOrThrow({
    where: { id: doctorId },
    select: { consultationFee: true, followUpFee: true, followUpWindowDays: true, currency: true },
  });

  const standard = doctor.consultationFee === null ? 0 : Number(doctor.consultationFee);
  const followUp = doctor.followUpFee === null ? null : Number(doctor.followUpFee);

  let qualifying: { id: string; scheduledAt: Date } | null = null;
  if (patientId && followUp !== null && doctor.followUpWindowDays > 0) {
    qualifying = await db.appointment.findFirst({
      where: {
        doctorId,
        patientId,
        status: "COMPLETED",
        feeKind: "STANDARD",
        scheduledAt: { gte: new Date(at.getTime() - doctor.followUpWindowDays * MS_PER_DAY), lt: at },
      },
      orderBy: { scheduledAt: "desc" },
      select: { id: true, scheduledAt: true },
    });
  }

  const isFollowUp = qualifying !== null && followUp !== null;
  return {
    configured: doctor.consultationFee !== null,
    kind: isFollowUp ? "FOLLOW_UP" : "STANDARD",
    amount: isFollowUp ? followUp : standard,
    currency: doctor.currency,
    standardAmount: standard,
    followUpAmount: followUp,
    followUpWindowDays: doctor.followUpWindowDays,
    qualifyingAppointmentId: qualifying?.id ?? null,
    qualifiesUntil: qualifying ? new Date(qualifying.scheduledAt.getTime() + doctor.followUpWindowDays * MS_PER_DAY) : null,
  };
}
