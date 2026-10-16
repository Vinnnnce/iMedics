import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { badRequest, conflict } from "./errors";
import { clinicParts, hhmmToMinutes } from "./clinic-time";
import { ACTIVE_APPOINTMENT_STATUSES, MAX_APPOINTMENT_MINUTES, addMinutes, overlaps } from "./appointments";

type Db = PrismaClient | Prisma.TransactionClient;

/** The requested start must be in the future and exactly one of the doctor's published slots. Returns the slot length. */
export async function findSlotMinutes(doctorId: string, start: Date, db: Db = prisma): Promise<number> {
  if (start.getTime() <= Date.now()) throw badRequest("Appointments must be in the future");

  const { dayOfWeek, minutes } = clinicParts(start);
  const windows = await db.doctorSchedule.findMany({ where: { doctorId, dayOfWeek, isActive: true } });
  const aligned = start.getUTCSeconds() === 0 && start.getUTCMilliseconds() === 0;
  const window = windows.find((w) => {
    const from = hhmmToMinutes(w.startTime);
    return aligned && minutes >= from && minutes + w.slotMinutes <= hhmmToMinutes(w.endTime) && (minutes - from) % w.slotMinutes === 0;
  });
  if (!window) throw conflict("That time is not one of the doctor's available slots");
  return window.slotMinutes;
}

/**
 * The same slot check for a booking against a specific service: the visit lasts the service's duration,
 * so the whole visit (not just one grid slot) must fit inside the window. Returns the duration to book.
 */
export async function findServiceSlotMinutes(doctorId: string, start: Date, durationMinutes: number, db: Db = prisma): Promise<number> {
  if (start.getTime() <= Date.now()) throw badRequest("Appointments must be in the future");

  const { dayOfWeek, minutes } = clinicParts(start);
  const windows = await db.doctorSchedule.findMany({ where: { doctorId, dayOfWeek, isActive: true } });
  const aligned = start.getUTCSeconds() === 0 && start.getUTCMilliseconds() === 0;
  const window = windows.find((w) => {
    const from = hhmmToMinutes(w.startTime);
    return aligned && minutes >= from && minutes + durationMinutes <= hhmmToMinutes(w.endTime) && (minutes - from) % w.slotMinutes === 0;
  });
  if (!window) throw conflict("That time is not one of the doctor's available slots");
  return durationMinutes;
}

/**
 * Neither the doctor nor the patient may already have an active appointment overlapping this slot.
 * Run inside a Serializable transaction so two people racing for a slot cannot both succeed.
 */
export async function assertSlotFree(
  tx: Prisma.TransactionClient,
  input: { doctorId: string; patientId: string; start: Date; durationMinutes: number; excludeId?: string },
): Promise<void> {
  const { doctorId, patientId, start, durationMinutes, excludeId } = input;
  const range = { gte: addMinutes(start, -MAX_APPOINTMENT_MINUTES), lt: addMinutes(start, durationMinutes) };
  const select = { scheduledAt: true, durationMinutes: true } as const;
  const notSelf = excludeId ? { id: { not: excludeId } } : {};

  const doctorBusy = await tx.appointment.findMany({
    where: { doctorId, status: { in: ACTIVE_APPOINTMENT_STATUSES }, scheduledAt: range, ...notSelf },
    select,
  });
  if (doctorBusy.some((b) => overlaps(start, durationMinutes, b.scheduledAt, b.durationMinutes))) throw conflict("This slot has just been taken");

  const patientBusy = await tx.appointment.findMany({
    where: { patientId, status: { in: ACTIVE_APPOINTMENT_STATUSES }, scheduledAt: range, ...notSelf },
    select,
  });
  if (patientBusy.some((b) => overlaps(start, durationMinutes, b.scheduledAt, b.durationMinutes))) {
    throw conflict("You already have an appointment at this time");
  }
}

/**
 * Appointments a doctor may see: free ones, or ones whose payment has been received. Bookings still waiting for
 * payment (or whose payment failed or expired) stay invisible to the doctor.
 */
export const visibleToDoctor: Prisma.AppointmentWhereInput = {
  OR: [{ payment: { is: null } }, { payment: { is: { status: { in: ["SUCCESSFUL", "REFUND_PENDING", "REFUNDED"] } } } }],
};
