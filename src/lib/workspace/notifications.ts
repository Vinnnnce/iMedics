import { randomUUID } from "node:crypto";
import webpush from "web-push";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPreferenceMatrix, isChannelEnabled } from "@/lib/notifications/preferences";
import { renderEmail, sendEmail } from "@/lib/notifications/email";
import { isPushConfigured } from "@/lib/notifications/push";

const genericBody = "You have an important update in your secure account. Sign in to view it.";
interface Delivery { id: string; owner_id: string; title: string; href: string; event_key: string; email_done: boolean; push_done: boolean }
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
  const jobs = await prisma.$queryRaw<Delivery[]>`
    UPDATE workspace_delivery SET lease_until = now() + interval '5 minutes', attempts = attempts + 1
    WHERE id IN (SELECT id FROM workspace_delivery WHERE (NOT email_done OR NOT push_done) AND attempts < 5
      AND (lease_until IS NULL OR lease_until < now()) ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED)
    RETURNING id, owner_id, title, href, event_key, email_done, push_done`;
  let completed = 0;
  for (const job of jobs) {
    const user = await prisma.user.findFirst({ where: { id: job.owner_id, status: "ACTIVE", deletedAt: null }, select: { email: true } });
    if (!user) continue;
    const type: NotificationType = job.event_key.startsWith("critical:") ? "LAB_RESULT" : "APPOINTMENT";
    const notification = { type, title: job.title, body: genericBody, href: job.href, data: {} };
    const prefs = await getPreferenceMatrix(job.owner_id);
    let emailDone = job.email_done, pushDone = job.push_done;
    let blocked = false;
    if (!emailDone) {
      if (!isChannelEnabled(prefs, type, "EMAIL")) emailDone = true;
      else if (process.env.RESEND_API_KEY) {
        try { await sendEmail({ to: user.email, ...renderEmail(notification) }); emailDone = true; }
        catch { /* Retry on next scheduled run. No clinical details in logs. */ }
      }
      else blocked = true;
    }
    if (!pushDone) {
      if (!isChannelEnabled(prefs, type, "PUSH")) pushDone = true;
      else if (isPushConfigured()) {
        const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: job.owner_id } });
        let ok = true;
        for (const s of subscriptions) {
          try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: job.title, body: genericBody, href: job.href }), { TTL: 3600 }); }
          catch (error) {
            if ([404,410].includes((error as { statusCode: number }).statusCode)) await prisma.pushSubscription.deleteMany({ where: { id: s.id } });
            else ok = false;
          }
        }
        // No enrolled browser is not a successful delivery.
        pushDone = subscriptions.length > 0 && ok;
        if (!subscriptions.length) blocked = true;
      }
      else blocked = true;
    }
    await prisma.$executeRaw`UPDATE workspace_delivery SET email_done = ${emailDone}, push_done = ${pushDone},
      attempts = attempts - ${blocked ? 1 : 0}, lease_until = now() + interval '5 minutes' WHERE id = ${job.id}::uuid`;
    if (emailDone && pushDone) completed++;
  }
  return { criticalResultsScanned: results.length, followupsQueued: followups.length, attempted: jobs.length, completed };
}
