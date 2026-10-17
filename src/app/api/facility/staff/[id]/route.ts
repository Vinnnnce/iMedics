import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess, assertSameFacility } from "@/lib/facility-auth";

const patchSchema = z.object({
  facilityRole: z.enum([
    "FACILITY_MANAGER", "DOCTOR", "LAB_SCIENTIST", "LAB_TECHNICIAN", "LAB_ASSISTANT",
    "PHLEBOTOMIST", "NURSE", "RADIOGRAPHER", "RECEPTIONIST", "ACCOUNTANT", "COMPLIANCE_OFFICER",
  ]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "ON_LEAVE", "TERMINATED"]).optional(),
  publicProfileVisible: z.boolean().optional(),
  bookingEligible: z.boolean().optional(),
  departmentId: z.string().uuid().nullish(),
  branchId: z.string().uuid().nullish(),
  resendInvite: z.boolean().optional(),
});

const select = {
  id: true, email: true, fullName: true, facilityRole: true, status: true,
  departmentId: true, branchId: true, publicProfileVisible: true, profileConsent: true,
  bookingEligible: true, acceptedAt: true, lastLoginAt: true,
} as const;

// PATCH /api/facility/staff/[id] — change a staff member's role, status, directory
// visibility or booking eligibility. OWNER rows are platform-managed: their role
// and termination are not editable here.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req, { requireVerified: false });
  const body = await parseBody(req, patchSchema);

  const staff = await prisma.facilityStaff.findUnique({ where: { id }, select: { ...select, facilityId: true } });
  if (!staff) throw notFound("Staff member not found");
  assertSameFacility(staff.facilityId, access.facility.id, "Staff member");

  if (staff.facilityRole === "OWNER") {
    if (body.facilityRole !== undefined || body.status === "TERMINATED") {
      throw forbidden("The facility owner's role is managed by Medic1905");
    }
  }

  const data: Record<string, unknown> = {};
  if (body.facilityRole !== undefined) data.facilityRole = body.facilityRole;
  if (body.status !== undefined) data.status = body.status;
  if (body.publicProfileVisible !== undefined) data.publicProfileVisible = body.publicProfileVisible;
  if (body.bookingEligible !== undefined) data.bookingEligible = body.bookingEligible;
  if (body.departmentId !== undefined) data.departmentId = body.departmentId ?? null;
  if (body.branchId !== undefined) data.branchId = body.branchId ?? null;

  if (body.resendInvite && staff.status === "INVITED") {
    if (!body.resendInvite) throw badRequest("Nothing to update");
    data.inviteExpiresAt = new Date(Date.now() + 7 * 86_400_000);
  }

  const updated = await prisma.facilityStaff.update({ where: { id }, data, select });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_STAFF_UPDATED",
    resourceType: "FacilityStaff", resourceId: id,
    details: { changes: Object.keys(data) }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ staff: updated });
});
