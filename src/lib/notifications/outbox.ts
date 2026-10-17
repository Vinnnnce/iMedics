import { randomUUID } from "node:crypto";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPreferenceMatrix, isChannelEnabled } from "./preferences";
import { renderEmail, sendEmail } from "./email";
import { isPushConfigured, sendPush } from "./push";
import type { RenderedNotification } from "./events";
import { safeNotificationHref } from "./safe-href";

export async function hasNotificationOutbox(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ installed: string | null }[]>`
    SELECT to_regclass('public.workspace_delivery')::text AS installed`;
  return Boolean(rows[0]?.installed);
}

/** Reuse the checked-in delivery table; never creates or migrates a database. */
export async function persistQueuedNotification(userId: string, notification: RenderedNotification, toast: boolean) {
  const id = randomUUID();
  await prisma.$transaction(async tx => {
    await tx.notification.create({ data: {
      id, userId, type: notification.type, title: notification.title, body: notification.body,
      href: notification.href, data: { ...notification.data, toast },
    } });
    await tx.$executeRaw`INSERT INTO workspace_delivery(id, owner_id, event_key, title, href)
      VALUES(${randomUUID()}::uuid, ${userId}::uuid, ${`notify:${notification.type}:${id}`}, ${notification.title}, ${notification.href})`;
  });
}

export function deliveryType(eventKey: string): NotificationType {
  if (eventKey.startsWith("critical:")) return "LAB_RESULT";
  const type = eventKey.split(":")[1];
  if (eventKey.startsWith("notify:") && ["APPOINTMENT", "MESSAGE", "PAYMENT", "LAB_RESULT", "PRESCRIPTION", "SYSTEM"].includes(type)) return type as NotificationType;
  return "APPOINTMENT";
}

interface Delivery {
  id: string; owner_id: string; title: string; href: string; event_key: string;
  email_done: boolean; push_done: boolean;
}

/** Leased, bounded, at-least-once delivery. A scheduler recovers interrupted sends. */
export async function deliverPendingNotifications(ownerId?: string) {
  const jobs = await prisma.$queryRaw<Delivery[]>`
    UPDATE workspace_delivery SET lease_until = now() + interval '5 minutes', attempts = attempts + 1
    WHERE id IN (SELECT id FROM workspace_delivery WHERE (NOT email_done OR NOT push_done) AND attempts < 5
      AND (${ownerId ?? null}::uuid IS NULL OR owner_id = ${ownerId ?? null}::uuid)
      AND (lease_until IS NULL OR lease_until < now()) ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED)
    RETURNING id, owner_id, title, href, event_key, email_done, push_done`;
  let completed = 0;
  for (const job of jobs) {
    try {
      const user = await prisma.user.findFirst({
        where: { id: job.owner_id, status: "ACTIVE", deletedAt: null }, select: { email: true },
      });
      if (!user) {
        await prisma.$executeRaw`UPDATE workspace_delivery SET email_done = true, push_done = true WHERE id = ${job.id}::uuid`;
        continue;
      }
      const type = deliveryType(job.event_key);
      const notification: RenderedNotification = {
        type, title: job.title, body: "You have an update in your secure account. Sign in to view it.",
        href: safeNotificationHref(job.href), data: {},
      };
      const prefs = await getPreferenceMatrix(job.owner_id);
      let emailDone = job.email_done, pushDone = job.push_done;
      let blocked = false, failed = false;
      if (!emailDone) {
        if (!isChannelEnabled(prefs, type, "EMAIL")) emailDone = true;
        else if (!process.env.RESEND_API_KEY) blocked = true;
        else {
          try { await sendEmail({ to: user.email, ...renderEmail(notification), idempotencyKey: job.id }); emailDone = true; }
          catch { failed = true; }
        }
      }
      if (!pushDone) {
        if (!isChannelEnabled(prefs, type, "PUSH")) pushDone = true;
        else if (!isPushConfigured()) blocked = true;
        else if (!await prisma.pushSubscription.count({ where: { userId: job.owner_id } })) blocked = true;
        else {
          try { pushDone = await sendPush(job.owner_id, notification); if (!pushDone) failed = true; }
          catch { failed = true; }
        }
      }
      await prisma.$executeRaw`UPDATE workspace_delivery SET email_done = ${emailDone}, push_done = ${pushDone},
        attempts = attempts - ${blocked && !failed ? 1 : 0}, lease_until = now() + interval '5 minutes' WHERE id = ${job.id}::uuid`;
      if (emailDone && pushDone) completed++;
    } catch {
      console.error("Notification delivery job failed", { jobId: job.id });
    }
  }
  return { attempted: jobs.length, completed };
}
