import { withAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hasNotificationOutbox } from "@/lib/notifications/outbox";

/** Operational counts only. Never returns recipient addresses, device keys, or message payloads. */
export const GET = withAuth(["ADMIN"], async (_req, { user }) => {
  const installed = await hasNotificationOutbox();
  const rows = installed ? await prisma.$queryRaw<{ pending: bigint; exhausted: bigint }[]>`
    SELECT count(*) FILTER (WHERE attempts < 5) AS pending,
      count(*) FILTER (WHERE attempts >= 5) AS exhausted
    FROM workspace_delivery WHERE NOT email_done OR NOT push_done` : [];
  await prisma.auditLog.create({ data: {
    userId: user.id, actorRole: user.role, action: "NOTIFICATION_HEALTH_READ", resourceType: "NotificationDelivery",
  } });
  return Response.json({
    outboxInstalled: installed,
    emailConfigured: Boolean(process.env.RESEND_API_KEY),
    pushConfigured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    pending: Number(rows[0]?.pending ?? 0), exhausted: Number(rows[0]?.exhausted ?? 0),
  });
});
