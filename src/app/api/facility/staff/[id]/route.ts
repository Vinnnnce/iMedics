import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess, assertSameFacility } from "@/lib/facility-auth";
import { validateOrganizationLinks, assertAcyclic, controlAudit } from "@/lib/organization/security";
import { ASSIGNABLE_ROLES, permissionsForRole } from "@/lib/facility-staff";
import { generateInviteToken } from "@/lib/facility-staff";
import { hashInviteToken, sendStaffInvitationEmail } from "@/lib/facility-invitations";
import { appUrl } from "@/lib/notifications/email";

const patchSchema = z.object({
  facilityRole: z.enum(ASSIGNABLE_ROLES as [import("@prisma/client").FacilityStaffRole, ...import("@prisma/client").FacilityStaffRole[]]).optional(),
  reportsToId: z.string().uuid().nullish(),
  professionalTitle: z.string().trim().max(120).nullish(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "LOCUM", "CONTRACT", "VOLUNTEER"]).optional(),
  cancelInvite: z.boolean().optional(),
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
    if (body.facilityRole !== undefined || body.status !== undefined || body.cancelInvite) {
      throw forbidden("The facility owner's role is managed by Medic1905");
    }
  }
  if (staff.status === "INVITED" && body.status === "ACTIVE") throw forbidden("Staff must accept their invitation themselves");
  if (body.facilityRole && access.facilityRole !== "OWNER" && permissionsForRole(body.facilityRole).some((p) => !access.permissions.includes(p))) throw forbidden("You cannot delegate permissions you do not hold");
  await validateOrganizationLinks(prisma, access.facility.id, body);

  const data: Record<string, unknown> = {};
  if (body.facilityRole !== undefined) data.facilityRole = body.facilityRole;
  if (body.status !== undefined) data.status = body.status;
  if (body.publicProfileVisible !== undefined) data.publicProfileVisible = body.publicProfileVisible;
  if (body.bookingEligible !== undefined) data.bookingEligible = body.bookingEligible;
  if (body.departmentId !== undefined) data.departmentId = body.departmentId ?? null;
  if (body.branchId !== undefined) data.branchId = body.branchId ?? null;
  if (body.reportsToId !== undefined) data.reportsToId = body.reportsToId ?? null;
  if (body.professionalTitle !== undefined) data.professionalTitle = body.professionalTitle;
  if (body.employmentType !== undefined) data.employmentType = body.employmentType;
  if (body.cancelInvite) Object.assign(data, { status: "TERMINATED", invitationState: "CANCELLED", inviteToken: null, inviteExpiresAt: null });
  let rawToken: string | null = null;

  if (body.resendInvite && staff.status === "INVITED") {
    if (!body.resendInvite) throw badRequest("Nothing to update");
    data.inviteExpiresAt = new Date(Date.now() + 7 * 86_400_000);
    rawToken = generateInviteToken();
    data.inviteToken = hashInviteToken(rawToken);
    data.invitationState = "PENDING_ACCEPTANCE";
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${access.facility.id}))::text`;
    if (body.reportsToId !== undefined) {
      const rows = await tx.facilityStaff.findMany({ where: { facilityId: access.facility.id }, select: { id: true, reportsToId: true } });
      assertAcyclic(id, body.reportsToId ?? null, rows.map((r) => ({ id: r.id, parentId: r.reportsToId })));
    }
    const row = await tx.facilityStaff.update({ where: { id }, data, select });
    await controlAudit(tx, user.id, access.facility.id, "FACILITY_STAFF_UPDATED", id, { changes: Object.keys(data) });
    return row;
  });
  if (rawToken) await sendStaffInvitationEmail({ to: staff.email, facilityName: access.facility.laboratoryName ?? "your facility", inviterName: user.name, redeemUrl: `${appUrl()}/invite/staff/${rawToken}` });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_STAFF_UPDATED",
    resourceType: "FacilityStaff", resourceId: id,
    details: { changes: Object.keys(data) }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ staff: updated });
});
