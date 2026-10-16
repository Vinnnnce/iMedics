import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { conflict, notFound } from "@/lib/errors";
import { assertSlotFree, findSlotMinutes, findServiceSlotMinutes, visibleToDoctor } from "@/lib/booking";
import { appointmentInclude, serializeAppointment } from "@/lib/appointment-shape";
import { queueNotification } from "@/lib/notifications/service";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ scheduledAt: z.coerce.date() });

// POST /api/appointments/[id]/reschedule — move an upcoming appointment to another of the doctor's free slots.
//  - doctors: the patient is notified and the appointment keeps its status
//  - patients: a confirmed appointment returns to "booked" so the doctor confirms the new time
// The price and payment are unchanged.
export const POST = withAuth<{ id: string }>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { scheduledAt: start } = await parseBody(req, schema);

  const access: Prisma.AppointmentWhereInput =
    user.role === "DOCTOR"
      ? { AND: [{ doctorId: (await getVerifiedDoctorProfile(user)).id }, visibleToDoctor] }
      : { patient: { userId: user.id } };

  const appointment = await prisma.appointment.findFirst({
    where: { AND: [{ id }, access] },
    include: { patient: { select: { userId: true } }, doctor: { select: { userId: true } }, payment: { select: { status: true } } },
  });
  if (!appointment) throw notFound("Appointment not found");

  if (appointment.status !== "BOOKED" && appointment.status !== "CONFIRMED") {
    throw conflict("Only upcoming, active appointments can be rescheduled");
  }
  if (appointment.scheduledAt <= new Date()) throw conflict("This appointment has already started");
  if (start.getTime() === appointment.scheduledAt.getTime()) throw conflict("Choose a different time");

  // A service appointment keeps the duration it was booked with, not the service's current one.
  const duration = appointment.serviceId ? appointment.durationMinutes : await findSlotMinutes(appointment.doctorId, start);
  // The whole visit (service bookings included) must fit inside a published window.
  await findServiceSlotMinutes(appointment.doctorId, start, duration);

  const updated = await prisma.$transaction(
    async (tx) => {
      await assertSlotFree(tx, { doctorId: appointment.doctorId, patientId: appointment.patientId, start, durationMinutes: duration, excludeId: id });
      return tx.appointment.update({
        where: { id },
        data: {
          scheduledAt: start,
          durationMinutes: duration,
          status: user.role === "PATIENT" && appointment.status === "CONFIRMED" ? "BOOKED" : appointment.status,
          reminder24hSentAt: null,
          reminder1hSentAt: null,
        },
        include: appointmentInclude,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  // A patient's unpaid booking is invisible to the doctor, so there is nobody to tell yet.
  const unpaid = appointment.payment !== null && appointment.payment.status !== "SUCCESSFUL";
  const other = user.role === "DOCTOR" ? appointment.patient.userId : unpaid ? null : appointment.doctor.userId;
  await queueNotification(other, { kind: "APPOINTMENT_RESCHEDULED", appointmentId: id });

  await writeAudit({ userId: user.id, actorRole: user.role, action: "APPOINTMENT_RESCHEDULED", resourceType: "Appointment", resourceId: id, req });

  return NextResponse.json({ appointment: serializeAppointment(updated) });
});
