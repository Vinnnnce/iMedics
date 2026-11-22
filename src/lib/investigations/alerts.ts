import { prisma } from "@/lib/prisma";
import { conflict, notFound } from "@/lib/errors";
import { facilityRecipients, notifySafely } from "./service";
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
  const existing = await prisma.investigation_critical_alerts.findUnique({ where: { resultId: input.resultId } });
  if (existing) return existing;
  const alert = await prisma.investigation_critical_alerts.create({
    data: {
      resultId: input.resultId, itemId: input.itemId, patientId: input.patientId, notifiedUserId: input.doctorUserId, facilityId: input.facilityId,
      summary: `${input.count} critical value${input.count === 1 ? "" : "s"}`,
      events: { create: { kind: "SENT", recipientUserId: input.doctorUserId, note: "Critical result alert sent to the requesting doctor" } },
    },
  });
  await notifySafely([input.doctorUserId], { kind: "INVESTIGATION_CRITICAL", alertId: alert.id, orderId: input.orderId });
  return alert;
}

export async function acknowledgeAlert(userId: string, alertId: string, note?: string) {
  const alert = await prisma.investigation_critical_alerts.findFirst({ where: { id: alertId, notifiedUserId: userId } });
  if (!alert) throw notFound("Alert not found");
  if (alert.status === "ACKNOWLEDGED" || alert.status === "RESOLVED") throw conflict("This alert has already been acknowledged");
  const updated = await prisma.investigation_critical_alerts.update({
    where: { id: alertId },
    data: { status: "ACKNOWLEDGED", acknowledgedById: userId, acknowledgedAt: new Date(), acknowledgementNote: note ?? null, events: { create: { kind: "ACKNOWLEDGED", actorUserId: userId, note: note ?? null } } },
    include: { result: { select: { item: { select: { orderId: true } } } } },
  });
  if (alert.facilityId) await notifySafely(await facilityRecipients(alert.facilityId, "VERIFY_RESULTS"), { kind: "INVESTIGATION_STATUS_CHANGED", orderId: updated.result.item.orderId });
  return updated;
}

/** Run from the escalation cron: widen the audience for unacknowledged alerts. */
export async function escalateInvestigationAlerts(now = new Date()) {
  const open = await prisma.investigation_critical_alerts.findMany({ where: { status: { in: ["SENT", "ESCALATED"] } }, include: { result: { select: { item: { select: { orderId: true } } } } }, take: 500 });
  let escalated = 0;
  for (const a of open) {
    const level = levelForAge((now.getTime() - a.createdAt.getTime()) / 60_000);
    if (level <= a.escalationLevel) continue;
    const orderId = a.result.item.orderId;
    const claimed = await prisma.investigation_critical_alerts.updateMany({ where: { id: a.id, escalationLevel: a.escalationLevel, status: { in: ["SENT", "ESCALATED"] } }, data: { escalationLevel: level, status: "ESCALATED", lastEscalatedAt: now } });
    if (claimed.count === 0) continue;
    const recipients = new Set<string>([a.notifiedUserId]);
    if (level >= 1 && a.facilityId) (await facilityRecipients(a.facilityId, "VERIFY_RESULTS")).forEach((id) => recipients.add(id));
    if (level >= 2) {
      const assigned = await prisma.patientAssignment.findMany({ where: { patientId: a.patientId, status: "ACTIVE" }, select: { doctor: { select: { userId: true } } } });
      assigned.forEach((x) => recipients.add(x.doctor.userId));
    }
    await prisma.investigation_alert_events.create({ data: { alertId: a.id, kind: "ESCALATED", note: `Escalated to level ${level}` } });
    await notifySafely([...recipients], { kind: "INVESTIGATION_CRITICAL_ESCALATED", alertId: a.id, orderId, level });
    if (level >= 3) await notifyAdmins({ kind: "INVESTIGATION_CRITICAL_ESCALATED", alertId: a.id, orderId, level }).catch(() => undefined);
    escalated++;
  }
  return { checked: open.length, escalated };
}

/** Facilities are told when items pass their target turnaround. Returns the number of overdue items found. */
export async function notifyOverdueItems(now = new Date()) {
  const overdue = await prisma.investigation_order_items.findMany({
    where: { dueAt: { lt: now }, performingFacilityId: { not: null }, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED", "REFERRAL_PENDING"] } },
    select: { id: true, orderId: true, performingFacilityId: true }, take: 500,
  });
  const byFacility = new Map<string, string>();
  for (const o of overdue) if (o.performingFacilityId && !byFacility.has(o.performingFacilityId)) byFacility.set(o.performingFacilityId, o.orderId);
  for (const [facilityId, orderId] of byFacility) await notifySafely(await facilityRecipients(facilityId), { kind: "INVESTIGATION_OVERDUE", orderId });
  return overdue.length;
}
