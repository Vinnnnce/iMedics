/**
 * Doctors publish their availability in clinic-local time. Medic1905 operates in
 * Nigeria (WAT, UTC+1, no daylight saving), so a fixed offset is exact.
 */
const CLINIC_UTC_OFFSET_MINUTES = 60;
const MS_PER_MINUTE = 60_000;

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Day of week (0 = Sunday) and minutes since midnight for an instant, in clinic time. */
export function clinicParts(date: Date): { dayOfWeek: number; minutes: number } {
  const local = new Date(date.getTime() + CLINIC_UTC_OFFSET_MINUTES * MS_PER_MINUTE);
  return { dayOfWeek: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

/** The instant for a clinic-local calendar date ("YYYY-MM-DD") and minutes since midnight. */
export function clinicInstant(date: string, minutes: number): Date {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, minutes - CLINIC_UTC_OFFSET_MINUTES));
}

/** Today's calendar date in clinic time, as "YYYY-MM-DD". */
export function clinicToday(): string {
  return new Date(Date.now() + CLINIC_UTC_OFFSET_MINUTES * MS_PER_MINUTE).toISOString().slice(0, 10);
}

/** An instant exactly the given number of days before now. */
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/** Start of the current calendar month in clinic time. */
export function monthStart(): Date {
  const date = new Date(Date.now() + CLINIC_UTC_OFFSET_MINUTES * MS_PER_MINUTE);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, -CLINIC_UTC_OFFSET_MINUTES));
}