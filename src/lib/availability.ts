import { prisma } from "./prisma";
import { clinicInstant, clinicParts, clinicToday, hhmmToMinutes } from "./clinic-time";
import { addMinutes, overlaps, ACTIVE_APPOINTMENT_STATUSES } from "./appointments";

const DAYS_TO_SCAN = 14;

/**
 * The doctor's earliest bookable slot, scanning published availability over the next two weeks.
 * Slots already taken by an active appointment are skipped. Used on the public profile to show
 * real availability — never a fabricated "next available" claim.
 */
export async function nextAvailableSlot(doctorId: string, now = new Date()) {
  const [windows, busy] = await Promise.all([
    prisma.doctorSchedule.findMany({ where: { doctorId, isActive: true } }),
    prisma.appointment.findMany({
      where: { doctorId, status: { in: ACTIVE_APPOINTMENT_STATUSES }, scheduledAt: { gte: addMinutes(now, -240), lt: addMinutes(now, DAYS_TO_SCAN * 24 * 60) } },
      select: { scheduledAt: true, durationMinutes: true },
    }),
  ]);
  if (windows.length === 0) return null;

  const byDay = new Map(windows.map((w) => [w.dayOfWeek, w]));
  const today = clinicToday();
  const todayMinutes = clinicParts(now).minutes;

  for (let offset = 0; offset < DAYS_TO_SCAN; offset += 1) {
    const date = new Date(clinicInstant(today, 0).getTime() + offset * 86_400_000).toISOString().slice(0, 10);
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    const window = byDay.get(day);
    if (!window) continue;

    const from = hhmmToMinutes(window.startTime);
    const end = hhmmToMinutes(window.endTime);
    let minutes = offset === 0 ? Math.max(from, Math.ceil((todayMinutes + 5) / window.slotMinutes) * window.slotMinutes) : from;
    if (minutes < from || (minutes - from) % window.slotMinutes !== 0) minutes = from;

    while (minutes + window.slotMinutes <= end) {
      const start = clinicInstant(date, minutes);
      if (start.getTime() > now.getTime() && !busy.some((b) => overlaps(start, window.slotMinutes, b.scheduledAt, b.durationMinutes))) {
        return { start, durationMinutes: window.slotMinutes };
      }
      minutes += window.slotMinutes;
    }
  }
  return null;
}
