import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { cancelAtPeriodEnd, resumeSubscription } from "@/lib/subscriptions";
import { writeAudit } from "@/lib/audit";

// POST /api/subscriptions/me/cancel — stop renewing; the doctor keeps access until the period ends.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  await cancelAtPeriodEnd(user.id);
  await writeAudit({ userId: user.id, actorRole: user.role, action: "SUBSCRIPTION_CANCEL_REQUESTED", resourceType: "DoctorSubscription", req });
  return NextResponse.json({ cancelled: true });
});

// DELETE /api/subscriptions/me/cancel — undo a pending cancellation.
export const DELETE = withAuth(["DOCTOR"], async (req, { user }) => {
  await resumeSubscription(user.id);
  await writeAudit({ userId: user.id, actorRole: user.role, action: "SUBSCRIPTION_RESUMED", resourceType: "DoctorSubscription", req });
  return NextResponse.json({ resumed: true });
});
