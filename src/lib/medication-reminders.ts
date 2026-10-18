import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notifications/service";
import { HHMM, hhmmToMinutes, clinicToday, clinicInstant } from "@/lib/clinic-time";

/**
 * Medication reminders and dose tracking.
 *
 * Reminder `times` are clinic-local "HH:mm" values. Doses are materialised as
 * DoseEvent rows (unique per reminder + scheduled instant) so that overlapping
 * cron runs never create duplicates. Status transitions are explicit:
 *
 *   SCHEDULED → ACKNOWLEDGED (patient saw the reminder; never "taken")
 *            → TAKEN / SKIPPED / MISSED (recorded by patient, clinician or the
 *              scheduler once the dose window has fully passed)
 *
 * Opening a notification NEVER marks a dose as taken.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

/** The dose window: a dose can be marked taken up to 2 hours late before the scheduler marks it missed. */
export const LATE_DOSE_GRACE_MS = 2 * HOUR_MS;

export interface ReminderLike {
  id: string;
  times: string[];
  startDate: Date;
  endDate: Date | null;
  active: boolean;
}

function validTimes(times: string[]): string[] {
  return times.filter((t) => HHMM.test(t)).slice(0, 8);
}

/**
 * Ensure DoseEvent rows exist for every scheduled time between `from` and `to`.
 * Idempotent: existing rows are left untouched. Runs at most a day ahead.
 */
export async function materialiseDoseEvents(reminder: ReminderLike & { patientId: string }, from: Date, to: Date): Promise<number> {
  const times = validTimes(reminder.times);
  if (times.length === 0 || !reminder.active) return 0;
  if (to.getTime() - from.getTime() > DAY_MS) to = new Date(from.getTime() + DAY_MS);

  let created = 0;
  // Walk clinic-local days covering the window.
  const dayStart = new Date(from.getTime());
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayKey = (d: Date) => new Date(d.getTime() + 60 * 60_000).toISOString().slice(0, 10); // clinic date
  let cursor = new Date(Math.max(from.getTime(), reminder.startDate.getTime()));
  const end = Math.min(to.getTime(), reminder.endDate ? reminder.endDate.getTime() : to.getTime());
  if (cursor.getTime() > end) return 0;

  while (cursor.getTime() <= end) {
    const dateKey = dayKey(cursor);
    for (const time of times) {
      const scheduledFor = clinicInstant(dateKey, hhmmToMinutes(time));
      if (scheduledFor.getTime() < from.getTime() || scheduledFor.getTime() > to.getTime()) continue;
      if (scheduledFor < reminder.startDate) continue;
      // Never materialise doses beyond the reminder's end date (e.g. a
      // discontinued prescription) even when the sweep window extends past it.
      if (reminder.endDate && scheduledFor.getTime() > reminder.endDate.getTime()) continue;
      const result = await prisma.doseEvent.createMany({
        data: { reminderId: reminder.id, patientId: reminder.patientId, scheduledFor },
        skipDuplicates: true,
      });
      created += result.count;
    }
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return created;
}

/**
 * The scheduler job: materialise upcoming doses, send due reminders, and mark
 * fully-passed doses as missed. Returns counts for the job's response.
 */
export async function runMedicationReminderSweep(now = new Date()) {
  let notified = 0;
  let missed = 0;

  const reminders = await prisma.medicationReminder.findMany({
    where: { active: true },
    include: { patient: { select: { userId: true } } },
    take: 500,
  });

  for (const reminder of reminders) {
    // 1. Materialise dose events for the next 24 hours.
    await materialiseDoseEvents({ ...reminder, patientId: reminder.patientId }, now, new Date(now.getTime() + DAY_MS));

    // 2. Notify about doses due in the next 15 minutes (not yet notified).
    const due = await prisma.doseEvent.findMany({
      where: {
        reminderId: reminder.id,
        status: "SCHEDULED",
        notifiedAt: null,
        scheduledFor: { gte: new Date(now.getTime() - 5 * 60_000), lte: new Date(now.getTime() + 15 * 60_000) },
      },
      take: 50,
    });
    for (const dose of due) {
      const claimed = await prisma.doseEvent.updateMany({
        where: { id: dose.id, notifiedAt: null },
        data: { notifiedAt: now },
      });
      if (claimed.count === 0) continue;
      // The notification never contains clinical details: just a gentle nudge.
      await notifyUsers([reminder.patient.userId], { kind: "MEDICATION_REMINDER", reminderId: reminder.id, doseEventId: dose.id });
      notified += 1;
    }

    // 3. Mark long-past unconfirmed doses as missed (after the grace window).
    const stale = await prisma.doseEvent.updateMany({
      where: {
        reminderId: reminder.id,
        status: { in: ["SCHEDULED", "ACKNOWLEDGED"] },
        scheduledFor: { lt: new Date(now.getTime() - LATE_DOSE_GRACE_MS) },
      },
      data: { status: "MISSED", recordedVia: "SYSTEM_MARK_MISSED", recordedAt: now },
    });
    missed += stale.count;
  }

  return { notified, missed, reminders: reminders.length };
}

/**
 * Record a dose status change by a human (patient or clinician). Opening a
 * notification is handled separately (acknowledge) and never marks a dose taken.
 * A recorded outcome (TAKEN/SKIPPED) is final: a later acknowledgement cannot
 * downgrade it, so an explicit patient record is never overwritten.
 */
export async function recordDoseStatus(
  doseEventId: string,
  status: "ACKNOWLEDGED" | "TAKEN" | "SKIPPED",
  byUserId: string,
  via: "PATIENT" | "CLINICIAN" = "PATIENT",
) {
  const dose = await prisma.doseEvent.findUnique({ where: { id: doseEventId } });
  if (!dose) throw Object.assign(new Error("Dose not found"), { status: 404 });
  if (status === "ACKNOWLEDGED" && (dose.status === "TAKEN" || dose.status === "SKIPPED")) {
    throw Object.assign(new Error("This dose already has a recorded outcome"), { status: 409 });
  }
  return prisma.doseEvent.update({
    where: { id: doseEventId },
    data: {
      status,
      acknowledgedAt: status === "ACKNOWLEDGED" ? new Date() : dose.acknowledgedAt,
      recordedAt: status === "ACKNOWLEDGED" ? dose.recordedAt : new Date(),
      recordedById: byUserId,
      recordedVia: via,
    },
  });
}

/** Adherence summary for a reminder or patient over a period (for dashboards). */
export async function adherenceSummary(patientId: string, days = 30) {
  const since = new Date(Date.now() - days * DAY_MS);
  const grouped = await prisma.doseEvent.groupBy({
    by: ["status"],
    where: { patientId, scheduledFor: { gte: since } },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Record<string, number>;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { total, taken: counts.TAKEN ?? 0, missed: counts.MISSED ?? 0, skipped: counts.SKIPPED ?? 0, acknowledged: counts.ACKNOWLEDGED ?? 0, scheduled: counts.SCHEDULED ?? 0 };
}

/** Create a reminder from a structured prescription item (idempotent per item). */
export async function ensureReminderForPrescriptionItem(prescriptionItemId: string, createdById: string) {
  const item = await prisma.prescriptionItem.findUnique({ where: { id: prescriptionItemId }, include: { prescription: true } });
  if (!item) throw Object.assign(new Error("Prescription item not found"), { status: 404 });
  const times = (item.schedule ?? []).filter((t) => HHMM.test(t));
  if (times.length === 0) return null;

  return prisma.medicationReminder.upsert({
    where: { prescriptionItemId },
    create: {
      patientId: item.prescription.patientId,
      prescriptionItemId,
      label: item.drugName,
      times,
      startDate: item.startDate ?? new Date(),
      endDate: item.endDate ?? null,
      createdById,
    },
    update: { times, active: true, endDate: item.endDate ?? null },
  });
}

/** Today's upcoming doses for a patient (dashboard list). */
export async function todaysDoses(patientId: string) {
  const today = clinicToday();
  const from = clinicInstant(today, 0);
  const to = clinicInstant(today, 24 * 60);
  return prisma.doseEvent.findMany({
    where: { patientId, scheduledFor: { gte: from, lt: to } },
    orderBy: { scheduledFor: "asc" },
    include: { reminder: { select: { label: true, times: true } } },
    take: 50,
  });
}
