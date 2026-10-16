import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile, getVerifiedFacilityProfile } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { queueNotification } from "@/lib/notifications/service";
const schema = z.object({ status: z.enum(["PAUSED", "CANCELLED"]), confirm: z.literal(true) });
export const PATCH = withAuth(["DOCTOR", "LAB_SCIENTIST"], async (req, { user }) => {
  if (user.role === "DOCTOR") await getVerifiedDoctorProfile(user);
  else await getVerifiedFacilityProfile(user);
  const body = await parseBody(req, schema);
  await prisma.$transaction(async tx => {
    const changed = await tx.$executeRaw`UPDATE workspace_subscriptions SET status = ${body.status}, updated_at = now()
      WHERE owner_id = ${user.id}::uuid AND status = 'ACTIVE'`;
    if (!changed) throw notFound("An active subscription record was not found");
    await tx.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "SUBSCRIPTION_SELF_SERVICE_UPDATED", resourceType: "Subscription", resourceId: user.id, details: { status: body.status } } });
  });
  await queueNotification(user.id, { kind: "SUBSCRIPTION_UPDATED" });
  return Response.json({ status: body.status, billingCancelled: false });
});
