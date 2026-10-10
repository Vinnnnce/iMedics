import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId, parseQuery } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { clinicInstant, hhmmToMinutes } from "@/lib/clinic-time";
import { ACTIVE_APPOINTMENT_STATUSES, MAX_APPOINTMENT_MINUTES, addMinutes, overlaps } from "@/lib/appointments";

const querySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD") });

// GET /api/doctors/[id]/availability?date=YYYY-MM-DD — free booking slots on a clinic-local date.
export const GET = withAuth<{ id: string }>(null, async (req, { params }) => {
  const doctorId = parseId((await params).id);
  const { date } = parseQuery(req, querySchema);

  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: doctorId, verificationStatus: "VERIFIED", acceptingPatients: true, user: { status: "ACTIVE", deletedAt: null } },
    select: { id: true },
  });
  if (!doctor) throw notFound("Doctor not found");

  // The weekday of a calendar date does not depend on the time zone.
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const windows = await prisma.doctorSchedule.findMany({
    where: { doctorId, dayOfWeek, isActive: true },
    orderBy: { startTime: "asc" },
  });

  const dayStart = clinicInstant(date, 0);
  const dayEnd = clinicInstant(date, 24 * 60);
  const booked = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
      scheduledAt: { gte: addMinutes(dayStart, -MAX_APPOINTMENT_MINUTES), lt: dayEnd },
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  const now = new Date();
  const slots: { startsAt: string; durationMinutes: number }[] = [];
  for (const window of windows) {
    const end = hhmmToMinutes(window.endTime);
    for (let m = hhmmToMinutes(window.startTime); m + window.slotMinutes <= end; m += window.slotMinutes) {
      const startsAt = clinicInstant(date, m);
      const free =
        startsAt > now && !booked.some((b) => overlaps(startsAt, window.slotMinutes, b.scheduledAt, b.durationMinutes));
      if (free) slots.push({ startsAt: startsAt.toISOString(), durationMinutes: window.slotMinutes });
    }
  }

  return NextResponse.json({ date, slots });
});
