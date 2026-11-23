import { prisma } from "@/lib/prisma";
import { conflict, notFound } from "@/lib/errors";
import { facilityRecipients, notifySafely } from "./service";
import { newId } from "./db";
import { notifyAdmins } from "@/lib/notifications/service";

/** Base response window; each escalation level doubles the wait. */
export function criticalWindowMinutes(): number {
  const raw = Number(process.env.INVESTIGATION_CRITICAL_ESCALATION_MINUTES ?? process.env.CRITICAL_ALERT_ESCALATION_WINDOW_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}
const MULTIPLIERS = [1, 2, 4] as const;

export function levelForAge(ageMinutes: number, window = criticalWindowMinutes()): number {
  let level = 0;
  MULTIPLIERS.forEach((m, i) => { if (ageMinutes >= m * window) level = i + 1; });
  return level;
}

export async function raiseCriticalAlert(input: { resultId: string; itemId: string; patientId: string; orderId: string; doctorUserId: string; facilityId: string; count: number }) {
  const existing = await prisma.investigation_critical_alerts.findUnique({ where: { result_id: input.resultId } });
  if (existing) return existing;
  const alert = await prisma.investigation_critical_alerts.create({
    data: {
      id: newId(), result_id: input.resultId, item_id: input.itemId, patient_id: input.patientId, notified_user_id: input.doctorUserId, facility_id: input.facilityId,
      summary: `${input.count} critical value${input.count === 1 ? "" : "s"}`,
      investigation_alert_events: { create: { id: newId(), kind: "SENT", recipient_user_id: input.doctorUserId, note: "Critical result alert sent to the requesting doctor" } },
    },
  });
  await notifySafely([input.doctorUserId], { kind: "INVESTIGATION_CRITICAL", alertId: alert.id, orderId: input.orderId });
  return alert;
}

export async function acknowledgeAlert(userId: string, alertId: string, note?: string) {
  const alert = await prisma.investigation_critical_alerts.findFirst({ where: { id: alertId, notified_user_id: userId } });
  if (!alert) throw notFound("Alert not found");
  if (alert.status === "ACKNOWLEDGED" || alert.status === "RESOLVED") throw conflict("This alert has already been acknowledged");
  const updated = await prisma.investigation_critical_alerts.update({
    where: { id: alertId },
    data: { status: "ACKNOWLEDGED", acknowledged_by_id: userId, acknowledged_at: new Date(), acknowledgement_note: note ?? null, investigation_alert_events: { create: { id: newId(), kind: "ACKNOWLEDGED", actor_user_id: userId, note: note ?? null } } },
    include: { investigation_results: { select: { investigation_order_items: { select: { order_id: true } } } } },
  });
  if (alert.facility_id) await notifySafely(await facilityRecipients(alert.facility_id, "VERIFY_RESULTS"), { kind: "INVESTIGATION_STATUS_CHANGED", orderId: updated.investigation_results.investigation_order_items.order_id });
  return updated;
}

/** Run from the escalation cron: widen the audience for unacknowledged alerts. */
export async function escalateInvestigationAlerts(now = new Date()) {
  const open = await prisma.investigation_critical_alerts.findMany({ where: { status: { in: ["SENT", "ESCALATED"] } }, include: { investigation_results: { select: { investigation_order_items: { select: { order_id: true } } } } }, take: 500 });
  let escalated = 0;
  for (const a of open) {
    const level = levelForAge((now.getTime() - a.created_at.getTime()) / 60_000);
    if (level <= a.escalation_level) continue;
    const orderId = a.investigation_results.investigation_order_items.order_id;
    const claimed = await prisma.investigation_critical_alerts.updateMany({ where: { id: a.id, escalation_level: a.escalation_level, status: { in: ["SENT", "ESCALATED"] } }, data: { escalation_level: level, status: "ESCALATED", last_escalated_at: now } });
    if (claimed.count === 0) continue;
    const recipients = new Set<string>([a.notified_user_id]);
    if (level >= 1 && a.facility_id) (await facilityRecipients(a.facility_id, "VERIFY_RESULTS")).forEach((id) => recipients.add(id));
    if (level >= 2) {
      const assigned = await prisma.patientAssignment.findMany({ where: { patientId: a.patient_id, status: "ACTIVE" }, select: { doctor: { select: { userId: true } } } });
      assigned.forEach((x) => recipients.add(x.doctor.userId));
    }
    await prisma.investigation_alert_events.create({ data: { id: newId(), alert_id: a.id, kind: "ESCALATED", note: `Escalated to level ${level}` } });
    await notifySafely([...recipients], { kind: "INVESTIGATION_CRITICAL_ESCALATED", alertId: a.id, orderId, level });
    if (level >= 3) await notifyAdmins({ kind: "INVESTIGATION_CRITICAL_ESCALATED", alertId: a.id, orderId, level }).catch(() => undefined);
    escalated++;
  }
  return { checked: open.length, escalated };
}

/** Facilities are told when items pass their target turnaround. Returns the number of overdue items found. */
export async function notifyOverdueItems(now = new Date()) {
  const overdue = await prisma.investigation_order_items.findMany({
    where: { due_at: { lt: now }, performing_facility_id: { not: null }, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED", "REFERRAL_PENDING"] } },
    select: { id: true, order_id: true, performing_facility_id: true }, take: 500,
  });
  const byFacility = new Map<string, string>();
  for (const o of overdue) if (o.performing_facility_id && !byFacility.has(o.performing_facility_id)) byFacility.set(o.performing_facility_id, o.order_id);
  for (const [facilityId, orderId] of byFacility) await notifySafely(await facilityRecipients(facilityId), { kind: "INVESTIGATION_OVERDUE", orderId });
  return overdue.length;
}
