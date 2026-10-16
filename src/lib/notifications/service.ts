import { after } from "next/server";
import { prisma } from "../prisma";
import { renderNotification, type NotificationEvent } from "./events";
import { getPreferenceMatrix, isChannelEnabled } from "./preferences";
import { renderEmail, sendEmail } from "./email";
import { sendPush } from "./push";
import { deliverPendingNotifications, hasNotificationOutbox, persistQueuedNotification } from "./outbox";

/** A recent unread message notification for the same conversation already covers new messages. */
const MESSAGE_COALESCE_MS = 30 * 60_000;

/**
 * Notify one user about an event: always an in-app notification, plus email and push when the user's
 * preferences allow. Persistence failures are surfaced; provider failures are retried by the outbox.
 */
export async function notifyUser(userId: string, event: NotificationEvent, deferDelivery = false): Promise<void> {
  try {
    const user = await prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE", deletedAt: null },
      select: { id: true, role: true, email: true },
    });
    if (!user) return;

    const rendered = renderNotification(event, user.role);

    if (event.kind === "MESSAGE_RECEIVED") {
      const recent = await prisma.notification.findFirst({
        where: {
          userId,
          type: "MESSAGE",
          readAt: null,
          createdAt: { gt: new Date(Date.now() - MESSAGE_COALESCE_MS) },
          data: { path: ["conversationId"], equals: event.conversationId },
        },
        select: { id: true },
      });
      if (recent) return;
    }

    const prefs = await getPreferenceMatrix(userId);

    const queued = await hasNotificationOutbox();
    if (queued) await persistQueuedNotification(userId, rendered, isChannelEnabled(prefs, rendered.type, "IN_APP"));
    else await prisma.notification.create({
      data: {
        userId,
        type: rendered.type,
        title: rendered.title,
        body: rendered.body,
        href: rendered.href,
        // `toast` records whether the user wants pop-up alerts for this category.
        data: { ...rendered.data, toast: isChannelEnabled(prefs, rendered.type, "IN_APP") },
      },
    });

    const deliver = async () => {
      if (queued) { await deliverPendingNotifications(userId); return; }
      // Backwards compatibility only: no retry guarantees without the existing delivery table.
      const deliveries: Promise<unknown>[] = [];
      if (isChannelEnabled(prefs, rendered.type, "EMAIL") && user.email) deliveries.push(sendEmail({ to: user.email, ...renderEmail(rendered) }));
      if (isChannelEnabled(prefs, rendered.type, "PUSH")) deliveries.push(sendPush(userId, rendered));
      const results = await Promise.allSettled(deliveries);
      if (results.some(r => r.status === "rejected")) console.error("Notification channel unavailable; delivery outbox not installed");
    };
    if (deferDelivery) after(deliver);
    else await deliver();
  } catch (error) {
    console.error("Notification persistence failed", { kind: error instanceof Error ? error.name : "UnknownError" });
    throw error;
  }
}

/** Notify several users (duplicates removed). */
export async function notifyUsers(userIds: (string | null | undefined)[], event: NotificationEvent): Promise<void> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  await Promise.all(unique.map((id) => notifyUser(id, event)));
}

/**
 * Persist before acknowledging the request. Only provider I/O runs after the response.
 */
export async function queueNotification(userId: string | null | undefined, event: NotificationEvent): Promise<void> {
  if (!userId) return;
  await notifyUser(userId, event, true);
}
