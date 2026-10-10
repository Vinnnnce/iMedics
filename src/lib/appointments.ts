import type { AppointmentStatus } from "@prisma/client";

/** Statuses that occupy a doctor's (or patient's) time. */
export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["BOOKED", "CONFIRMED", "IN_PROGRESS"];

/** Longest appointment we ever store; bounds the look-behind when checking for overlaps. */
export const MAX_APPOINTMENT_MINUTES = 240;

const MS_PER_MINUTE = 60_000;

export function overlaps(aStart: Date, aMinutes: number, bStart: Date, bMinutes: number): boolean {
  const aEnd = aStart.getTime() + aMinutes * MS_PER_MINUTE;
  const bEnd = bStart.getTime() + bMinutes * MS_PER_MINUTE;
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

/** Allowed status changes. Who may perform them is decided in the route. */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  BOOKED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};
