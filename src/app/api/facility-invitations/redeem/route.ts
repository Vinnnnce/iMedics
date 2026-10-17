import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { redeemStaffInvitation } from "@/lib/facility-invitations";
import { queueNotification } from "@/lib/notifications/service";

const redeemSchema = z.object({ token: z.string().trim().min(20).max(64) });

// POST /api/facility-invitations/redeem — a staff member accepts a facility
// invitation with their own signed-in account. The account's email must match
// the invited address exactly; the invitation is single-use and expires after 7 days.
export const POST = withAuth(null, async (req, { user }) => {
  const { token } = await parseBody(req, redeemSchema);

  const staff = await redeemStaffInvitation(user, token);
  const facility = await prisma.labStaffProfile.findUniqueOrThrow({
    where: { id: staff.facilityId },
    select: { userId: true },
  });

  // Tell the facility owner the new staff member has joined.
  await queueNotification(facility.userId, { kind: "FACILITY_STAFF_JOINED", facilityId: staff.facilityId });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_STAFF_JOINED",
    resourceType: "FacilityStaff", resourceId: staff.id,
    details: { facilityId: staff.facilityId, email: staff.email }, facilityId: staff.facilityId, req,
  });

  return NextResponse.json({
    staff: { id: staff.id, fullName: staff.fullName, facilityRole: staff.facilityRole, facilityId: staff.facilityId },
    message: "Invitation accepted. You now have access to the facility dashboard.",
  });
});
