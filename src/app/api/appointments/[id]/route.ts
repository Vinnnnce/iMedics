import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { APPOINTMENT_TRANSITIONS } from "@/lib/appointments";
import { appointmentInclude, serializeAppointment } from "@/lib/appointment-shape";
import { writeAudit } from "@/lib/audit";

const patchSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"]),
});

// PATCH /api/appointments/[id] — change an appointment's status.
//  - doctors: confirm, start, complete, mark no-show, or cancel their own appointments
//  - patients: cancel their own future appointments
// Confirming a booking admits the patient to the doctor's care (PatientAssignment).
export const PATCH = withAuth<{ id: string }>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { status } = await parseBody(req, patchSchema);

  const access: Prisma.AppointmentWhereInput =
    user.role === "DOCTOR"
      ? { doctorId: (await getVerifiedDoctorProfile(user)).id }
      : { patient: { userId: user.id } };

  const appointment = await prisma.appointment.findFirst({
    where: { AND: [{ id }, access] },
    include: { patient: { select: { userId: true } }, doctor: { select: { userId: true } } },
  });
  if (!appointment) throw notFound("Appointment not found");

  if (user.role === "PATIENT" && status !== "CANCELLED") {
    throw forbidden("Patients can only cancel appointments");
  }
  if (!APPOINTMENT_TRANSITIONS[appointment.status].includes(status)) {
    throw conflict(`An appointment that is ${appointment.status.toLowerCase()} cannot be changed to ${status.toLowerCase()}`);
  }

  const now = new Date();
  if (status === "CANCELLED" && user.role === "PATIENT" && appointment.scheduledAt <= now) {
    throw conflict("Past appointments cannot be cancelled");
  }
  if (status === "NO_SHOW" && appointment.scheduledAt > now) {
    throw conflict("An appointment cannot be marked as a no-show before it starts");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.appointment.update({
      where: { id },
      data: {
        status,
        ...(status === "CONFIRMED" && appointment.mode === "VIDEO" && !appointment.videoRoomId
          ? { videoRoomId: `mc-${randomUUID()}` }
          : {}),
      },
      include: appointmentInclude,
    });

    if (status === "CONFIRMED") {
      await tx.patientAssignment.upsert({
        where: { patientId_doctorId: { patientId: appointment.patientId, doctorId: appointment.doctorId } },
        create: { patientId: appointment.patientId, doctorId: appointment.doctorId },
        update: { status: "ACTIVE", dischargedAt: null },
      });
    }

    if (status === "CONFIRMED" || status === "CANCELLED") {
      const recipient = user.role === "DOCTOR" ? appointment.patient.userId : appointment.doctor.userId;
      if (recipient) {
        await tx.notification.create({
          data: {
            userId: recipient,
            type: "APPOINTMENT",
            title: status === "CONFIRMED" ? "Appointment confirmed" : "Appointment cancelled",
            data: { appointmentId: id },
          },
        });
      }
    }
    return result;
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: `APPOINTMENT_${status}`,
    resourceType: "Appointment",
    resourceId: id,
    req,
  });

  return NextResponse.json({ appointment: serializeAppointment(updated) });
});
