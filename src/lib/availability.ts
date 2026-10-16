import { prisma } from "./prisma";
import { clinicInstant, clinicParts, hhmmToMinutes } from "./clinic-time";
import { addMinutes, overlaps, ACTIVE_APPOINTMENT_STATUSES } from "./appointments";

const MS_PER_DAY = 86_400_000;
// Clinic time is WAT (UTC+1, no DST) — the same fixed offset clinic-time.ts uses.
const CLINIC_OFFSET_MS = 60 * 60_000;
const DAYS_TO_SCAN = 14;

/**
 * The doctor's earliest bookable slot, scanning published availability over the next two weeks.
 * All windows on a day are considered, slots already taken by an active appointment are skipped,
 * and the scan is anchored on the supplied instant (clinic-local dates). Used on the public profile
 * to show real availability — never a fabricated "next available" claim.
 */
export async function nextAvailableSlot(doctorId: string, now = new Date()) {
  const [windows, busy] = await Promise.all([
    prisma.doctorSchedule.findMany({ where: { doctorId, isActive: true } }),
    prisma.appointment.findMany({
      where: { doctorId, status: { in: ACTIVE_APPOINTMENT_STATUSES }, scheduledAt: { gte: addMinutes(now, -240), lt: new Date(now.getTime() + DAYS_TO_SCAN * MS_PER_DAY) } },
      select: { scheduledAt: true, durationMinutes: true },
    }),
  ]);
  if (windows.length === 0) return null;

  // The clinic-local calendar date of `now`.
  const localNow = new Date(now.getTime() + CLINIC_OFFSET_MS);
  const todayParts = { y: localNow.getUTCFullYear(), m: localNow.getUTCMonth(), d: localNow.getUTCDate() };
  const nowMinutes = clinicParts(now).minutes;

  for (let offset = 0; offset < DAYS_TO_SCAN; offset += 1) {
    // Noon UTC keeps the calendar date stable regardless of time zone quirks.
    const dayDate = new Date(Date.UTC(todayParts.y, todayParts.m, todayParts.d + offset, 12, 0, 0));
    const date = dayDate.toISOString().slice(0, 10);
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
    const dayWindows = windows.filter((w) => w.dayOfWeek === dayOfWeek);

    for (const window of dayWindows) {
      const from = hhmmToMinutes(window.startTime);
      const end = hhmmToMinutes(window.endTime);
      let minutes = from;
      if (offset === 0) {
        // Today: skip to the next grid point at least five minutes in the future.
        minutes = from + Math.ceil((nowMinutes + 5 - from) / window.slotMinutes) * window.slotMinutes;
        minutes = Math.max(minutes, from);
      }

      while (minutes + window.slotMinutes <= end) {
        const start = clinicInstant(date, minutes);
        if (start.getTime() > now.getTime() && !busy.some((b) => overlaps(start, window.slotMinutes, b.scheduledAt, b.durationMinutes))) {
          return { start, durationMinutes: window.slotMinutes };
        }
        minutes += window.slotMinutes;
      }
    }
  }
  return null;
}
