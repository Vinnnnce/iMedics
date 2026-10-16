import { randomUUID } from "node:crypto";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPreferenceMatrix, isChannelEnabled } from "@/lib/notifications/preferences";
import { deliverPendingNotifications } from "@/lib/notifications/outbox";

const genericBody = "You have an important update in your secure account. Sign in to view it.";
/** Durable deduplication covers the in-app record and both external delivery jobs. */
export async function enqueueWorkspaceNotification(ownerId: string, eventKey: string, title: string, href: string, type: NotificationType) {
  const prefs = await getPreferenceMatrix(ownerId);
  await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`INSERT INTO workspace_delivery(id, owner_id, event_key, title, href)
      VALUES(${randomUUID()}::uuid, ${ownerId}::uuid, ${eventKey}, ${title}, ${href}) ON CONFLICT(event_key) DO NOTHING RETURNING id`;
    if (!rows.length) return;
    await tx.notification.create({ data: { userId: ownerId, type, title, body: genericBody, href,
      data: { workspaceEvent: eventKey, toast: isChannelEnabled(prefs, type, "IN_APP") } } });
  });
}
export async function processWorkspaceNotifications() {
  // New critical results are scanned independently of dashboard visits.
  const results = await prisma.labResult.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, patient: { deletedAt: null }, values: { some: { flag: { in: ["CRITICAL_HIGH", "CRITICAL_LOW"] } } } },
    orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, status: true, patient: { select: { userId: true, assignments: { where: { status: "ACTIVE", doctor: { verificationStatus: "VERIFIED", user: { status: "ACTIVE", deletedAt: null } } }, select: { doctor: { select: { userId: true } } } } } } },
  });
  for (const result of results) {
    for (const assignment of result.patient.assignments) await enqueueWorkspaceNotification(assignment.doctor.userId, `critical:${result.id}:${assignment.doctor.userId}`, "A result needs your review", "/doctor/lab-requests", "LAB_RESULT");
    if (result.status === "VERIFIED" && result.patient.userId) await enqueueWorkspaceNotification(result.patient.userId, `critical:${result.id}:${result.patient.userId}`, "Your care team has an update", "/patient/results", "LAB_RESULT");
  }
  const followups = await prisma.$queryRaw<{ id: string; recipient_id: string }[]>`
    SELECT f.id, f.recipient_id FROM workspace_followups f
    JOIN users u ON u.id = f.recipient_id
    JOIN consultations c ON c.id = f.consultation_id
    JOIN patients p ON p.id = c.patient_id
    WHERE f.sent_at IS NULL AND f.due_at <= now() AND u.status = 'ACTIVE' AND u.deleted_at IS NULL AND p.deleted_at IS NULL
    ORDER BY f.due_at LIMIT 100`;
  for (const f of followups) {
    await enqueueWorkspaceNotification(f.recipient_id, `followup:${f.id}`, "Your follow-up is due", "/patient/appointments", "APPOINTMENT");
    await prisma.$executeRaw`UPDATE workspace_followups SET sent_at = now() WHERE id = ${f.id}::uuid`;
  }
  const delivery = await deliverPendingNotifications();
  return { criticalResultsScanned: results.length, followupsQueued: followups.length, ...delivery };
}
