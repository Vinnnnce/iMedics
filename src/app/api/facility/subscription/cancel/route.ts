import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { setFacilityCancelAtPeriodEnd } from "@/lib/facility-subscriptions";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ cancel: z.boolean() });

// POST /api/facility/subscription/cancel — stop (or resume) renewal at the end of the paid period.
export const POST = withAuth(null, async (req, { user }) => {
  const { facility } = await requireFacilityAccess(user, "MANAGE_PAYOUTS", req);
  const { cancel } = await parseBody(req, schema);
  await setFacilityCancelAtPeriodEnd(facility.id, cancel);
  await writeAudit({ userId: user.id, actorRole: user.role, action: cancel ? "FACILITY_SUBSCRIPTION_CANCEL_SCHEDULED" : "FACILITY_SUBSCRIPTION_RESUMED", resourceType: "LabStaffProfile", resourceId: facility.id, req });
  return NextResponse.json({ success: true });
});
