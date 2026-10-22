/**
 * Module 02 — critical result alert escalation.
 *
 * Escalates alerts that have not been acknowledged within the response window
 * (`CRITICAL_ALERT_ESCALATION_MINUTES`, spec default 30 minutes; the base window
 * can be overridden with the `CRITICAL_ALERT_ESCALATION_WINDOW_MINUTES`
 * environment variable — a platform-configurable default, not clinical policy).
 * Each level widens the audience: the requesting facility is re-notified at
 * level 1, the performing facility is added at level 2 and platform
 * administrators are added from level 3.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { notifyAdmins } from "@/lib/notifications/service";
import { renderNotification } from "@/lib/notifications/events";
import { hasNotificationOutbox } from "@/lib/notifications/outbox";
import { writeAudit } from "@/lib/audit";
import { CRITICAL_ALERT_ESCALATION_MINUTES } from "./workflows";

/** Multipliers of the base window at which each escalation level triggers. */
const LEVEL_MULTIPLIERS = [1, 2, 4] as const;
export const MAX_ESCALATION_LEVEL = LEVEL_MULTIPLIERS.length;

export interface EscalationSummary {
  checked: number;
  escalated: number;
  /** Alerts whose escalation update lost a race with acknowledgement/resolution. */
  skipped: number;
}

/** Base response window in minutes (env override for platform configuration). */
export function escalationWindowMinutes(): number {
  const raw = Number(process.env.CRITICAL_ALERT_ESCALATION_WINDOW_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : CRITICAL_ALERT_ESCALATION_MINUTES;
}

/** The escalation level an alert of the given age has reached (0 = none yet). */
export function escalationLevelFor(ageMinutes: number, windowMinutes = escalationWindowMinutes()): number {
  let level = 0;
  for (let i = 0; i < LEVEL_MULTIPLIERS.length; i++) {
    if (ageMinutes >= LEVEL_MULTIPLIERS[i] * windowMinutes) level = i + 1;
  }
  return level;
}

interface PendingAlert {
  id: string;
  escalationLevel: number;
  createdAt: Date;
  labResultId: string;
  labOrderId: string | null;
  orderingFacilityId: string | null;
  notifiedUserId: string | null;
  labResult: { uploadedById: string | null } | null;
}

/** Collect the user ids that must be notified when escalating to `level`. */
function recipientsForLevel(alert: PendingAlert, level: number): string[] {
  const ids = new Set<string>();

  // The requesting facility (hospital that ordered the investigation), or —
  // when the alert was created without one — the user it was addressed to.
  if (alert.orderingFacilityId) ids.add(`facility:${alert.orderingFacilityId}`);
  else if (alert.notifiedUserId) ids.add(alert.notifiedUserId);

  // From level 2, also notify the performing facility (the laboratory).
  if (level >= 2 && alert.labResult?.uploadedById) ids.add(alert.labResult.uploadedById);

  return [...ids];
}

/** Resolve facility placeholders to the facility profile's user id. */
async function resolveRecipientId(recipient: string): Promise<string | null> {
  if (!recipient.startsWith("facility:")) return recipient;
  const facilityId = recipient.slice("facility:".length);
  const facilityUser = await prisma.labStaffProfile
    .findUnique({ where: { id: facilityId }, select: { user: { select: { id: true } } } })
    .then((f) => f?.user?.id)
    .catch(() => undefined);
  return facilityUser ?? null;
}

/**
 * Escalate every unacknowledged critical alert whose response window has
 * elapsed. Safe to run concurrently or on a delayed schedule: each alert is
 * advanced with a conditional update, so an acknowledgement or resolution that
 * lands mid-run cancels the escalation, and a delayed run that jumps several
 * levels still notifies the audience of every level it passed.
 */
export async function escalateCriticalResultAlerts(now = new Date()): Promise<EscalationSummary> {
  const windowMinutes = escalationWindowMinutes();
  const cutoff = new Date(now.getTime() - windowMinutes * 60_000);

  const pending = await prisma.criticalResultAlert.findMany({
    where: {
      status: { in: ["SENT", "ESCALATED"] },
      acknowledgedAt: null,
      createdAt: { lte: cutoff },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      escalationLevel: true,
      createdAt: true,
      labResultId: true,
      labOrderId: true,
      orderingFacilityId: true,
      notifiedUserId: true,
      labResult: { select: { uploadedById: true } },
    },
  });

  // Resolve recipients outside the transaction; their notifications are then
  // persisted atomically with the escalation below.
  const outboxInstalled = await hasNotificationOutbox();

  const summary: EscalationSummary = { checked: pending.length, escalated: 0, skipped: 0 };

  for (const alert of pending) {
    const ageMinutes = (now.getTime() - alert.createdAt.getTime()) / 60_000;
    const dueLevel = escalationLevelFor(ageMinutes, windowMinutes);
    if (dueLevel <= alert.escalationLevel) continue;

    // Notify the audience of every level the alert passed through, so a
    // delayed run never skips the responsible recipients.
    const recipientIds = new Set<string>();
    for (let level = alert.escalationLevel + 1; level <= dueLevel; level++) {
      for (const id of recipientsForLevel(alert, level)) recipientIds.add(id);
    }
    // Platform administrators join from level 3.
    if (dueLevel >= 3) recipientIds.add("admins");
    const resolved: string[] = [];
    for (const recipient of recipientIds) {
      if (recipient === "admins") continue; // delivered below, outside the tx
      const id = await resolveRecipientId(recipient);
      if (id) resolved.push(id);
    }

    const event = { kind: "CRITICAL_ALERT_ESCALATED" as const, alertId: alert.id, level: dueLevel };

    // One transaction: the conditional escalation advance and every recipient's
    // notification (in-app row plus outbox job when installed) either land
    // together or not at all — a failed notification never leaves an alert at
    // a level whose audience was never told.
    const advanced = await prisma.$transaction(async (tx) => {
      const result = await tx.criticalResultAlert.updateMany({
        where: {
          id: alert.id,
          status: { in: ["SENT", "ESCALATED"] },
          acknowledgedAt: null,
          escalationLevel: alert.escalationLevel,
        },
        data: { status: "ESCALATED", escalationLevel: dueLevel, escalatedAt: now },
      });
      if (result.count === 0) return 0;

      for (const userId of resolved) {
        const user = await tx.user.findFirst({
          where: { id: userId, deletedAt: null },
          select: { id: true, role: true },
        });
        if (!user) continue;
        const rendered = renderNotification(event, user.role);
        await tx.notification.create({
          data: {
            userId: user.id,
            type: rendered.type,
            title: rendered.title,
            body: rendered.body,
            href: rendered.href,
            data: { ...rendered.data, escalation: `${alert.id}:${dueLevel}` },
          },
        });
        if (outboxInstalled) {
          await tx.$executeRaw`INSERT INTO workspace_delivery(id, owner_id, event_key, title, href)
            VALUES(${randomUUID()}::uuid, ${user.id}::uuid, ${`critical:${alert.id}:${dueLevel}:${user.id}`}::text, ${rendered.title}::text, ${rendered.href}::text)`;
        }
      }
      return result.count;
    });

    if (advanced === 0) {
      summary.skipped += 1;
      continue; // Acknowledged/resolved/escalated concurrently — do not notify.
    }
    summary.escalated += 1;

    // Administrators are notified outside the transaction (they are a
    // platform-wide audience, not the alert's responsible recipients).
    if (dueLevel >= 3) {
      await notifyAdmins(event).catch(() => undefined);
    }

    await writeAudit({
      userId: null,
      action: "CRITICAL_ALERT_ESCALATED",
      resourceType: "CriticalResultAlert",
      resourceId: alert.id,
      details: { level: dueLevel, previousLevel: alert.escalationLevel, recipients: resolved.length, system: true },
    });
  }

  return summary;
}
