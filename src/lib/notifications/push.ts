import webpush from "web-push";
import { prisma } from "../prisma";
import type { RenderedNotification } from "./events";
import { isSafePushEndpoint } from "./push-validation";

let configured: boolean | null = null;

/** Web push needs a VAPID key pair (npx web-push generate-vapid-keys). Without one, push is simply off. */
export function isPushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@example.com", publicKey, privateKey);
  return (configured = true);
}

/** Push the generic notification to all of the user's browsers. Dead subscriptions are removed. */
export async function sendPush(userId: string, notification: RenderedNotification): Promise<boolean> {
  if (!isPushConfigured()) return false;
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return false;

  const payload = JSON.stringify({ title: notification.title, body: notification.body, url: notification.href });
  const outcomes = await Promise.all(
    subscriptions.map(async (s) => {
      if (!isSafePushEndpoint(s.endpoint)) {
        await prisma.pushSubscription.deleteMany({ where: { id: s.id } });
        return true;
      }
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 3600, timeout: 10_000 },
        );
        return true;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.deleteMany({ where: { id: s.id } });
          return true;
        } else {
          console.error("Push delivery failed", { status: status ?? "unavailable" });
          return false;
        }
      }
    }),
  );
  return outcomes.every(Boolean);
}
