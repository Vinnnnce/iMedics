import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { assertSlotFree, findSlotMinutes, visibleToDoctor } from "@/lib/booking";
import { resolveConsultationFee } from "@/lib/pricing";
import { assertPaymentsAvailable, createPendingPayment, expireStalePayments } from "@/lib/payments/service";
import { queueNotification } from "@/lib/notifications/service";
import { appointmentInclude, serializeAppointment } from "@/lib/appointment-shape";
import { writeAudit } from "@/lib/audit";
import { recordBookingConversion } from "@/lib/workspace/experiments";

const bookSchema = z.object({
  doctorId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  mode: z.enum(["VIDEO", "CHAT", "IN_PERSON"]).default("VIDEO"),
  reason: z.string().trim().max(1000).optional(),
  followUpOfId: z.string().uuid().optional(),
});

// POST /api/appointments — a patient books a slot from a doctor's published availability.
// The price is decided here, never by the client: standard fee, or the follow-up fee when the patient qualifies.
// Paid bookings hold the slot until payment completes (see PAYMENT_HOLD_MINUTES); the doctor hears about a booking
// only once it is paid. The doctor must then confirm, which also admits the patient to their care.
export const POST = withAuth(["PATIENT"], async (req, { user }) => {
  const data = await parseBody(req, bookSchema);

  const patient = await prisma.patient.findFirst({
    where: { userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!patient) throw conflict("Please complete your registration before booking");

  const doctor = await prisma.doctorProfile.findFirst({
    where: {
      id: data.doctorId,
      verificationStatus: "VERIFIED",
      acceptingPatients: true,
      user: { status: "ACTIVE", deletedAt: null },
    },
    select: { id: true, userId: true },
  });
  if (!doctor) throw notFound("Doctor not found");

  // Release slots held by abandoned payments before checking availability.
  await expireStalePayments();

  const start = data.scheduledAt;
  const duration = await findSlotMinutes(doctor.id, start);

  if (data.followUpOfId) {
    const previous = await prisma.appointment.findFirst({
      where: { id: data.followUpOfId, patientId: patient.id },
      select: { id: true },
    });
    if (!previous) throw badRequest("The appointment you are following up on was not found");
  }

  const fee = await resolveConsultationFee(doctor.id, patient.id, start);
  if (!fee.configured) throw conflict("This doctor has not published a consultation fee yet");
  if (fee.amount > 0) assertPaymentsAvailable();

  // Serializable: two people racing for the same slot cannot both succeed.
  const { appointment, payment } = await prisma.$transaction(
    async (tx) => {
      await assertSlotFree(tx, { doctorId: doctor.id, patientId: patient.id, start, durationMinutes: duration });

      const created = await tx.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          scheduledAt: start,
          durationMinutes: duration,
          mode: data.mode,
          reason: data.reason || null,
          followUpOfId: data.followUpOfId ?? (fee.kind === "FOLLOW_UP" ? fee.qualifyingAppointmentId : null),
          feeKind: fee.kind,
          feeAmount: fee.amount,
          feeCurrency: fee.currency,
        },
        include: appointmentInclude,
      });

      const charge =
        fee.amount > 0
          ? await createPendingPayment(tx, {
              kind: "CONSULTATION",
              payerId: user.id,
              payeeId: doctor.userId,
              appointmentId: created.id,
              description: fee.kind === "FOLLOW_UP" ? "Follow-up consultation fee" : "Consultation fee",
              amount: fee.amount,
              currency: fee.currency,
            })
          : null;
      await recordBookingConversion(user, created.id, tx);
      return { appointment: created, payment: charge };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  // Free bookings reach the doctor now; paid ones are announced when the payment succeeds.
  if (!payment) await queueNotification(doctor.userId, { kind: "APPOINTMENT_REQUESTED", appointmentId: appointment.id });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "APPOINTMENT_BOOKED",
    resourceType: "Appointment",
    resourceId: appointment.id,
    details: { feeKind: fee.kind, amount: fee.amount, currency: fee.currency },
    req,
  });

  return NextResponse.json(
    {
      appointment: serializeAppointment(appointment),
      payment: payment && { id: payment.id, amount: Number(payment.amount), currency: payment.currency, status: payment.status, expiresAt: payment.expiresAt },
    },
    { status: 201 },
  );
});

const listSchema = z.object({
  status: z.enum(["BOOKED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/appointments — doctors see their own appointments, patients see theirs.
export const GET = withAuth(["DOCTOR", "PATIENT"], async (req, { user }) => {
  const { status, from, to, limit } = parseQuery(req, listSchema);

  const owner: Prisma.AppointmentWhereInput =
    user.role === "DOCTOR"
      ? { AND: [{ doctorId: (await getVerifiedDoctorProfile(user)).id }, visibleToDoctor] }
      : { patient: { userId: user.id } };

  const where: Prisma.AppointmentWhereInput = {
    ...owner,
    ...(status ? { status } : {}),
    ...(from || to ? { scheduledAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    take: limit,
    include: appointmentInclude,
  });

  return NextResponse.json({ appointments: appointments.map(serializeAppointment) });
});
