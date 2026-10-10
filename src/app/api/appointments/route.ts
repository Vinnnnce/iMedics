import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { clinicParts, hhmmToMinutes } from "@/lib/clinic-time";
import { ACTIVE_APPOINTMENT_STATUSES, MAX_APPOINTMENT_MINUTES, addMinutes, overlaps } from "@/lib/appointments";
import { appointmentInclude, serializeAppointment } from "@/lib/appointment-shape";
import { writeAudit } from "@/lib/audit";

const bookSchema = z.object({
  doctorId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  mode: z.enum(["VIDEO", "CHAT", "IN_PERSON"]).default("VIDEO"),
  reason: z.string().trim().max(1000).optional(),
  followUpOfId: z.string().uuid().optional(),
});

// POST /api/appointments — a patient books a slot from a doctor's published availability.
// The doctor must confirm; confirming also admits the patient to the doctor's care.
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

  const start = data.scheduledAt;
  if (start.getTime() <= Date.now()) throw badRequest("Appointments must be in the future");

  // The requested time must be exactly one of the doctor's published slots.
  const { dayOfWeek, minutes } = clinicParts(start);
  const windows = await prisma.doctorSchedule.findMany({
    where: { doctorId: doctor.id, dayOfWeek, isActive: true },
  });
  const aligned = start.getUTCSeconds() === 0 && start.getUTCMilliseconds() === 0;
  const window = windows.find((w) => {
    const from = hhmmToMinutes(w.startTime);
    return (
      aligned &&
      minutes >= from &&
      minutes + w.slotMinutes <= hhmmToMinutes(w.endTime) &&
      (minutes - from) % w.slotMinutes === 0
    );
  });
  if (!window) throw conflict("That time is not one of the doctor's available slots");

  if (data.followUpOfId) {
    const previous = await prisma.appointment.findFirst({
      where: { id: data.followUpOfId, patientId: patient.id },
      select: { id: true },
    });
    if (!previous) throw badRequest("The appointment you are following up on was not found");
  }

  const duration = window.slotMinutes;
  const end = addMinutes(start, duration);

  // Serializable: two people racing for the same slot cannot both succeed.
  const appointment = await prisma.$transaction(
    async (tx) => {
      const range = { gte: addMinutes(start, -MAX_APPOINTMENT_MINUTES), lt: end };
      const select = { scheduledAt: true, durationMinutes: true } as const;

      const doctorBusy = await tx.appointment.findMany({
        where: { doctorId: doctor.id, status: { in: ACTIVE_APPOINTMENT_STATUSES }, scheduledAt: range },
        select,
      });
      if (doctorBusy.some((b) => overlaps(start, duration, b.scheduledAt, b.durationMinutes))) {
        throw conflict("This slot has just been taken");
      }

      const patientBusy = await tx.appointment.findMany({
        where: { patientId: patient.id, status: { in: ACTIVE_APPOINTMENT_STATUSES }, scheduledAt: range },
        select,
      });
      if (patientBusy.some((b) => overlaps(start, duration, b.scheduledAt, b.durationMinutes))) {
        throw conflict("You already have an appointment at this time");
      }

      const created = await tx.appointment.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          scheduledAt: start,
          durationMinutes: duration,
          mode: data.mode,
          reason: data.reason || null,
          followUpOfId: data.followUpOfId,
        },
        include: appointmentInclude,
      });

      // No patient details in the notification text.
      await tx.notification.create({
        data: {
          userId: doctor.userId,
          type: "APPOINTMENT",
          title: "New booking request",
          body: "A patient has requested an appointment.",
          data: { appointmentId: created.id },
        },
      });
      return created;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "APPOINTMENT_BOOKED",
    resourceType: "Appointment",
    resourceId: appointment.id,
    req,
  });

  return NextResponse.json({ appointment: serializeAppointment(appointment) }, { status: 201 });
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
      ? { doctorId: (await getVerifiedDoctorProfile(user)).id }
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
