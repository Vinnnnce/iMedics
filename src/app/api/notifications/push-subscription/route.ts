import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { isPushConfigured } from "@/lib/notifications/push";
import { pushSubscriptionSchema } from "@/lib/notifications/push-validation";

// POST /api/notifications/push-subscription — register this browser for push notifications.
export const POST = withAuth(null, async (req, { user }) => {
  if (!isPushConfigured()) throw badRequest("Push notifications are not enabled on this server");
  const { endpoint, keys } = await parseBody(req, pushSubscriptionSchema);
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    // A browser endpoint belongs to whoever is signed in on it now.
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: req.headers.get("user-agent")?.slice(0, 300) },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
  });
  return NextResponse.json({ success: true }, { status: 201 });
});

// DELETE /api/notifications/push-subscription — stop push notifications on this browser.
export const DELETE = withAuth(null, async (req, { user }) => {
  const { endpoint } = await parseBody(req, z.object({ endpoint: z.string().url().max(2000) }));
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return NextResponse.json({ success: true });
});
