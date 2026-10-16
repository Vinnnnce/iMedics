import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId, parseQuery } from "@/lib/api";
import { badRequest, notFound } from "@/lib/errors";
import { clinicInstant, hhmmToMinutes } from "@/lib/clinic-time";
import { expireStalePayments } from "@/lib/payments/service";
import { ACTIVE_APPOINTMENT_STATUSES, MAX_APPOINTMENT_MINUTES, addMinutes, overlaps } from "@/lib/appointments";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  // Optional service from the doctor's catalogue: slots must fit that service's duration.
  serviceId: z.string().uuid().optional(),
});

// GET /api/doctors/[id]/availability?date=YYYY-MM-DD&serviceId=uuid — free booking slots on a clinic-local date.
export const GET = withAuth<{ id: string }>(null, async (req, { params }) => {
  const doctorId = parseId((await params).id);
  const { date, serviceId } = parseQuery(req, querySchema);

  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: doctorId, verificationStatus: "VERIFIED", acceptingPatients: true, user: { status: "ACTIVE", deletedAt: null } },
    select: { id: true },
  });
  if (!doctor) throw notFound("Doctor not found");

  // A service booking lasts the service's duration, so only slots that fit it are offered.
  let durationMinutes: number | null = null;
  if (serviceId) {
    const service = await prisma.doctorService.findUnique({
      where: { id: serviceId },
      select: { doctorId: true, isActive: true, durationMinutes: true },
    });
    if (!service || service.doctorId !== doctorId || !service.isActive) throw badRequest("That service is not available");
    durationMinutes = service.durationMinutes;
  }

  // Slots held by abandoned payments become free again.
  await expireStalePayments();

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
    // A service slot must fit the service's whole duration inside the window; a plain booking uses the slot grid.
    const visit = durationMinutes ?? window.slotMinutes;
    for (let m = hhmmToMinutes(window.startTime); m + visit <= end; m += window.slotMinutes) {
      const startsAt = clinicInstant(date, m);
      const free =
        startsAt > now && !booked.some((b) => overlaps(startsAt, visit, b.scheduledAt, b.durationMinutes));
      if (free) slots.push({ startsAt: startsAt.toISOString(), durationMinutes: visit });
    }
  }

  return NextResponse.json({ date, slots });
});
