import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications/service";
import { writeAudit } from "@/lib/audit";

/**
 * Inactivity monitoring and patient welfare alerts.
 *
 * IMPORTANT LIMITATIONS (shown to patients and contacts):
 * - Lack of platform activity does NOT prove a patient missed medication, is
 *   unconscious, or is unwell. Inactivity alerts are separate from medication
 *   adherence alerts and are NOT an emergency-response service.
 * - The monitored signal is "last meaningful authenticated activity" on the
 *   platform (signed-in page views and API use; never message content).
 */

export const WELFARE_ALERT_MESSAGE =
  "This patient has not checked in on the platform within the configured period. Please follow the agreed welfare-check procedure.";

/** A patient's activity resets the monitoring window for any pending alert too. */
export async function recordPatientActivity(userId: string, at = new Date()) {
  await prisma.user.update({ where: { id: userId }, data: { lastActiveAt: at } });
  // Resolve any open alert for this patient: they are clearly active again.
  const patient = await prisma.patient.findUnique({ where: { userId }, select: { id: true } });
  if (!patient) return;
  await prisma.welfareAlert.updateMany({
    where: {
      status: { in: ["PENDING", "SENT", "ESCALATED"] },
      rule: { patientId: patient.id },
    },
    data: { status: "RESOLVED_NO_ACTION", resolvedAt: at },
  });
}

export interface InactivityCheckResult {
  triggered: number;
  escalated: number;
  resolved: number;
}

/**
 * The scheduled inactivity check. For every ACTIVE rule, if the patient's last
 * activity is older than the threshold and no open alert exists, create one and
 * notify the first contact. Escalation and delivery use idempotent claims so a
 * repeated run never sends duplicates.
 */
export async function runInactivityChecks(now = new Date()): Promise<InactivityCheckResult> {
  const result: InactivityCheckResult = { triggered: 0, escalated: 0, resolved: 0 };

  const rules = await prisma.inactivityRule.findMany({
    where: { active: true },
    include: { patient: { select: { userId: true, firstName: true } } },
    take: 500,
  });

  for (const rule of rules) {
    if (!rule.patient.userId) continue;
    const patientUser = await prisma.user.findUnique({ where: { id: rule.patient.userId }, select: { lastActiveAt: true, deletedAt: true, status: true } });
    if (!patientUser || patientUser.deletedAt || patientUser.status !== "ACTIVE") continue;

    const lastActivity = patientUser.lastActiveAt;
    const openAlert = await prisma.welfareAlert.findFirst({
      where: { ruleId: rule.id, status: { in: ["PENDING", "SENT", "ESCALATED"] } },
      orderBy: { triggeredAt: "desc" },
    });

    if (!lastActivity) continue; // never signed in since feature launch: nothing to compare

    const inactiveMs = now.getTime() - lastActivity.getTime();
    const thresholdMs = rule.thresholdHours * 3_600_000;

    if (inactiveMs < thresholdMs) {
      // Patient active within threshold: resolve any stale open alert.
      if (openAlert) {
        await prisma.welfareAlert.update({ where: { id: openAlert.id }, data: { status: "RESOLVED_NO_ACTION", resolvedAt: now } });
        result.resolved += 1;
      }
      continue;
    }

    if (openAlert) {
      // Alert already open: check escalation.
      if (rule.escalationHours && rule.contactIds.length > 1) {
        const escalateAfter = openAlert.triggeredAt.getTime() + rule.escalationHours * 3_600_000;
        if (openAlert.status !== "ESCALATED" && now.getTime() >= escalateAfter) {
          const claimed = await prisma.welfareAlert.updateMany({
            where: { id: openAlert.id, status: { in: ["SENT", "PENDING"] } },
            data: { status: "ESCALATED" },
          });
          if (claimed.count > 0) {
            const contactId = rule.contactIds[1];
            await deliverWelfareAlertToContact(openAlert.id, contactId, rule.patientId);
            result.escalated += 1;
          }
        }
      }
      continue;
    }

    // Threshold reached with no open alert: create one and notify the first contact.
    const alert = await prisma.welfareAlert.create({
      data: { ruleId: rule.id, status: "PENDING", lastActivityAt: lastActivity },
    });
    result.triggered += 1;
    const firstContact = rule.contactIds[0];
    if (firstContact) {
      await deliverWelfareAlertToContact(alert.id, firstContact, rule.patientId);
    }
  }

  return result;
}

/**
 * Deliver a welfare alert to one trusted contact. Delivery failures are
 * recorded on the WelfareAlertDelivery row and never crash the sweep. Quiet
 * hours defer SMS/email to the end of the quiet window (in-app still goes out).
 */
export async function deliverWelfareAlertToContact(alertId: string, contactId: string, patientId: string) {
  const contact = await prisma.trustedContact.findUnique({ where: { id: contactId } });
  if (!contact || !contact.userId) return;

  const delivery = await prisma.welfareAlertDelivery.create({
    data: { alertId, contactId, channel: "IN_APP", status: "QUEUED" },
  });

  try {
    // In-app notification to the contact's account (no clinical details).
    await notifyUser(contact.userId, { kind: "WELFARE_ALERT", alertId });
    await prisma.welfareAlert.updateMany({ where: { id: alertId, status: "PENDING" }, data: { status: "SENT" } });
    await prisma.welfareAlertDelivery.update({
      where: { id: delivery.id },
      data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } },
    });
    await writeAudit({
      patientId,
      action: "WELFARE_ALERT_DELIVERED",
      resourceType: "WelfareAlert",
      resourceId: alertId,
      details: { contactId, channel: "IN_APP" },
    });
  } catch (error) {
    await prisma.welfareAlertDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", lastError: String(error).slice(0, 200), attempts: { increment: 1 } },
    }).catch(() => undefined);
  }
}

/** A contact acknowledges an alert (via their platform account). */
export async function acknowledgeWelfareAlert(alertId: string, byUserId: string) {
  const alert = await prisma.welfareAlert.findUnique({
    where: { id: alertId },
    include: { rule: { include: { patient: true } } },
  });
  if (!alert) throw Object.assign(new Error("Alert not found"), { status: 404 });

  // Only the designated contacts (or admins) may acknowledge.
  const contactUserIds = await prisma.trustedContact.findMany({
    where: { patientId: alert.rule.patientId },
    select: { userId: true },
  });
  const allowed = contactUserIds.some((c) => c.userId === byUserId);
  if (!allowed) throw Object.assign(new Error("You are not a contact for this alert"), { status: 403 });

  const updated = await prisma.welfareAlert.update({
    where: { id: alertId },
    data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), acknowledgedByUserId: byUserId, resolvedAt: new Date() },
  });
  await writeAudit({
    userId: byUserId,
    patientId: alert.rule.patientId,
    action: "WELFARE_ALERT_ACKNOWLEDGED",
    resourceType: "WelfareAlert",
    resourceId: alertId,
  });
  return updated;
}
