import type { Prisma } from "@prisma/client";
import { effectivePermissions } from "@/lib/facility-auth";
import { renderNotification, type NotificationEvent } from "@/lib/notifications/events";
import { persistQueuedNotificationInTransaction } from "@/lib/notifications/outbox";

/** Only PHI-free event bodies go into the existing durable delivery outbox.
 * Failure aborts the clinical transaction; providers run outside it via cron. */
export async function queueDocumentWorkflowNotifications(tx: Prisma.TransactionClient, documentId: string, action: string, actorId: string | null) {
  if (!["SUBMITTED", "REVIEWED", "RELEASED"].includes(action)) return;
  const doc = await tx.clinicalDocument.findUniqueOrThrow({
    where: { id: documentId }, select: { facilityId: true, authorId: true, status: true, patient: { select: { userId: true } } },
  });
  const ids = new Set<string>();
  let event: NotificationEvent;
  if (action === "RELEASED") {
    if (!doc.patient.userId) return;
    ids.add(doc.patient.userId);
    event = { kind: "CLINICAL_DOCUMENT_RELEASED", documentId };
  } else if (action === "REVIEWED") {
    ids.add(doc.authorId);
    event = { kind: "CLINICAL_DOCUMENT_ACTION_NEEDED", documentId, step: "SIGNATURE" };
  } else {
    if (doc.status !== "PENDING_REVIEW") return;
    const staff = await tx.facilityStaff.findMany({
      where: { facilityId: doc.facilityId, status: "ACTIVE", userId: { not: null } },
      // Resolve each member's real, effective permissions (role defaults plus
      // any custom per-staff overrides) — a reviewer granted REVIEW_DOCUMENTS
      // through an explicit custom access level must still be notified.
      select: { userId: true, facilityRole: true, accessLevel: true, permissionOverrides: true },
    });
    for (const member of staff) {
      if (member.userId && member.userId !== actorId && effectivePermissions(member).includes("REVIEW_DOCUMENTS")) ids.add(member.userId);
    }
    event = { kind: "CLINICAL_DOCUMENT_ACTION_NEEDED", documentId, step: "REVIEW" };
  }
  const recipients = await tx.user.findMany({
    where: { id: { in: [...ids] }, status: "ACTIVE", deletedAt: null }, select: { id: true, role: true },
  });
  for (const recipient of recipients) {
    const rendered = renderNotification(event, recipient.role);
    const preference = await tx.notificationPreference.findFirst({
      where: { userId: recipient.id, category: rendered.type, channel: "IN_APP" }, select: { enabled: true },
    });
    await persistQueuedNotificationInTransaction(tx, recipient.id, rendered, preference?.enabled ?? true);
  }
}
