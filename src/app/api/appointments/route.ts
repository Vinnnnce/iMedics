import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { assertSlotFree, findSlotMinutes, findServiceSlotMinutes, visibleToDoctor } from "@/lib/booking";
import { resolveConsultationFee } from "@/lib/pricing";
import { assertPaymentsAvailable, createPendingPayment, expireStalePayments } from "@/lib/payments/service";
import { queueNotification } from "@/lib/notifications/service";
import { allowanceExhausted, requireEntitlement } from "@/lib/subscriptions";
import { appointmentInclude, serializeAppointment } from "@/lib/appointment-shape";
import { writeAudit } from "@/lib/audit";
import { recordBookingConversion } from "@/lib/workspace/experiments";

const bookSchema = z.object({
  doctorId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  mode: z.enum(["VIDEO", "CHAT", "IN_PERSON"]).default("VIDEO"),
  reason: z.string().trim().max(1000).optional(),
  followUpOfId: z.string().uuid().optional(),
  // Optional service from the doctor's catalogue; the visit is priced and timed from it.
  serviceId: z.string().uuid().optional(),
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

  // Cheap existence checks first (fast 404s); every decision below is re-taken inside the
  // Serializable transaction so a stale client can never book an unavailable slot or service.
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

  // The doctor's subscription decides which consultation modes they offer and how many bookings
  // their monthly allowance still covers.
  if (data.mode === "VIDEO") await requireEntitlement(doctor.userId, "video");
  if (await allowanceExhausted(doctor.userId)) {
    throw conflict("This doctor's monthly consultation allowance is used up. Please check back next month.");
  }

  // Release slots held by abandoned payments before checking availability.
  await expireStalePayments();

  const start = data.scheduledAt;

  // Serializable: two people racing for the same slot cannot both succeed, and the doctor's
  // bookability, the service and the price are all decided here, not by the client.
  const { appointment, payment, fee } = await prisma.$transaction(
    async (tx) => {
      const bookable = await tx.doctorProfile.findFirst({
        where: {
          id: data.doctorId,
          verificationStatus: "VERIFIED",
          acceptingPatients: true,
          user: { status: "ACTIVE", deletedAt: null },
        },
        select: { id: true, userId: true, consultationModes: true },
      });
      if (!bookable) throw notFound("Doctor not found");

      // Only the consultation modes the doctor actually offers may be booked.
      if (bookable.consultationModes.length > 0 && !bookable.consultationModes.includes(data.mode)) {
        throw badRequest("That consultation mode is not offered by this doctor");
      }

      // The service, when given, must be the doctor's own, active, and support this mode.
      let service: { id: string; name: string; durationMinutes: number } | null = null;
      if (data.serviceId) {
        const found = await tx.doctorService.findUnique({
          where: { id: data.serviceId },
          select: { id: true, doctorId: true, name: true, durationMinutes: true, modes: true, isActive: true, currency: true },
        });
        if (!found || found.doctorId !== bookable.id || !found.isActive) throw badRequest("That service is not available");
        if (found.modes.length > 0 && !found.modes.includes(data.mode)) throw badRequest("That service does not support this consultation mode");
        service = { id: found.id, name: found.name, durationMinutes: found.durationMinutes };
        // A service priced in a currency the doctor no longer uses cannot be booked until updated.
        const account = await tx.doctorProfile.findUniqueOrThrow({ where: { id: bookable.id }, select: { currency: true } });
        if (found.currency !== account.currency) throw badRequest("That service is not available");
      }

      // The slot must be one of the doctor's published slots, and a service visit lasts that service's duration.
      const duration = await (service ? findServiceSlotMinutes(bookable.id, start, service.durationMinutes, tx) : findSlotMinutes(bookable.id, start, tx));

      if (data.followUpOfId) {
        // A follow-up must follow this doctor's own completed appointment for this patient.
        const previous = await tx.appointment.findFirst({
          where: { id: data.followUpOfId, patientId: patient.id, doctorId: bookable.id },
          select: { id: true, status: true },
        });
        if (!previous) throw badRequest("The appointment you are following up on was not found");
        if (previous.status !== "COMPLETED") throw badRequest("A follow-up can only follow a completed consultation");
      }

      const resolvedFee = await resolveConsultationFee(bookable.id, patient.id, start, tx, service?.id ?? null);
      if (!resolvedFee.configured) throw conflict("This doctor has not published a consultation fee yet");
      if (resolvedFee.amount > 0) assertPaymentsAvailable();

      await assertSlotFree(tx, { doctorId: bookable.id, patientId: patient.id, start, durationMinutes: duration });

      const created = await tx.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: bookable.id,
          scheduledAt: start,
          durationMinutes: duration,
          mode: data.mode,
          reason: data.reason || null,
          followUpOfId: data.followUpOfId ?? (resolvedFee.kind === "FOLLOW_UP" ? resolvedFee.qualifyingAppointmentId : null),
          feeKind: resolvedFee.kind,
          feeAmount: resolvedFee.amount,
          feeCurrency: resolvedFee.currency,
          serviceId: service?.id ?? null,
          serviceName: service?.name ?? null,
        },
        include: appointmentInclude,
      });

      const charge =
        resolvedFee.amount > 0
          ? await createPendingPayment(tx, {
              kind: "CONSULTATION",
              payerId: user.id,
              payeeId: bookable.userId,
              appointmentId: created.id,
              description: resolvedFee.kind === "FOLLOW_UP" ? "Follow-up consultation fee" : "Consultation fee",
              amount: resolvedFee.amount,
              currency: resolvedFee.currency,
            })
          : null;
      await recordBookingConversion(user, created.id, tx);
      return { appointment: created, payment: charge, fee: resolvedFee };
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
    details: { feeKind: fee.kind, amount: fee.amount, currency: fee.currency, serviceId: data.serviceId ?? null },
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
