import { after } from "next/server";
import { prisma } from "../prisma";
import { renderNotification, type NotificationEvent } from "./events";
import { getPreferenceMatrix, isChannelEnabled } from "./preferences";
import { renderEmail, sendEmail } from "./email";
import { sendPush } from "./push";

/** A recent unread message notification for the same conversation already covers new messages. */
const MESSAGE_COALESCE_MS = 30 * 60_000;

/**
 * Notify one user about an event: always an in-app notification, plus email and push when the user's
 * preferences allow. Never throws: a failed email must not undo the action that caused it.
 */
export async function notifyUser(userId: string, event: NotificationEvent): Promise<void> {
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

    await prisma.notification.create({
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

    const deliveries: Promise<unknown>[] = [];
    if (isChannelEnabled(prefs, rendered.type, "EMAIL") && user.email) {
      deliveries.push(sendEmail({ to: user.email, ...renderEmail(rendered) }));
    }
    if (isChannelEnabled(prefs, rendered.type, "PUSH")) {
      deliveries.push(sendPush(userId, rendered));
    }
    const results = await Promise.allSettled(deliveries);
    for (const r of results) if (r.status === "rejected") console.error("Notification delivery failed:", r.reason);
  } catch (error) {
    console.error("Notification failed:", error);
  }
}

/** Notify several users (duplicates removed). */
export async function notifyUsers(userIds: (string | null | undefined)[], event: NotificationEvent): Promise<void> {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  await Promise.all(unique.map((id) => notifyUser(id, event)));
}

/**
 * Send after the HTTP response has been returned, so email and push never slow the request down.
 * Use this from route handlers.
 */
export function queueNotification(userId: string | null | undefined, event: NotificationEvent): void {
  if (!userId) return;
  after(() => notifyUser(userId, event));
}
