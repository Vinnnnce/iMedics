import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { ASSIGNABLE_ROLES, FACILITY_ROLE_LABEL, permissionsForRole, type FacilityStaffRole } from "@/lib/facility-staff";
import { createStaffInvitation, sendStaffInvitationEmail } from "@/lib/facility-invitations";

const inviteSchema = z.object({
  email: z.string().trim().email().max(120),
  fullName: z.string().trim().min(2).max(120),
  facilityRole: z.string().refine(
    (r): r is FacilityStaffRole => (ASSIGNABLE_ROLES as readonly string[]).includes(r),
    { message: "Unsupported staff role" },
  ),
  departmentId: z.string().uuid().nullish(),
  branchId: z.string().uuid().nullish(),
  customCategory: z.string().trim().max(120).nullish(),
  professionalTitle: z.string().trim().max(120).nullish(),
  specialty: z.string().trim().max(160).nullish(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "LOCUM", "CONTRACT", "VOLUNTEER"]).nullish(),
  expiryDays: z.number().int().min(1).max(30).default(7),
});

// GET /api/facility/staff — the facility's staff directory (management view).
export const GET = withAuth(null, async (req, { user }) => {
  const { facility } = await requireFacilityAccess(user, "MANAGE_STAFF", req, { requireVerified: false });
  const staff = await prisma.facilityStaff.findMany({
    where: { facilityId: facility.id, status: { not: "TERMINATED" } },
    orderBy: [{ fullName: "asc" }],
    select: {
      id: true, email: true, fullName: true, facilityRole: true, status: true,
      department: { select: { name: true } }, branch: { select: { name: true } },
      employmentType: true, publicProfileVisible: true, profileConsent: true,
      bookingEligible: true, professionalTitle: true, photoUrl: true, specialty: true,
      userId: true, acceptedAt: true, lastLoginAt: true,
      accessLevel: true, customCategory: true, departmentIds: true,
      credentials: { select: { id: true, expiryDate: true, verificationStatus: true, type: true } },
    },
  });
  return NextResponse.json({ staff });
});

// POST /api/facility/staff — invite a staff member by work email.
// The invitee redeems a single-use link with their own verified Clerk account;
// the system never creates accounts or sets passwords.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req, { requireVerified: false });
  const input = await parseBody(req, inviteSchema);

  if (!input.facilityRole) throw badRequest("Unsupported staff role");
  if (access.facilityRole !== "OWNER" && permissionsForRole(input.facilityRole).some((p) => !access.permissions.includes(p))) throw badRequest("You cannot delegate permissions you do not hold");

  const invitation = await createStaffInvitation({
    ...input,
    facilityId: access.facility.id,
    email: input.email,
    fullName: input.fullName,
    facilityRole: input.facilityRole,
    departmentId: input.departmentId ?? null,
    branchId: input.branchId ?? null,
    customCategory: input.customCategory ?? null,
    invitedById: user.id,
  });

  let delivered = false;
  try { await sendStaffInvitationEmail({
    to: input.email,
    facilityName: access.facility.laboratoryName ?? "your facility",
    redeemUrl: invitation.redeemUrl,
    inviterName: user.name,
  }); delivered = true; } catch { /* Membership remains pending and can be resent; no false success. */ }

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_STAFF_INVITED",
    resourceType: "FacilityStaff", resourceId: invitation.staffId,
    details: { role: input.facilityRole, email: input.email, customCategory: input.customCategory ?? null }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({
    staffId: invitation.staffId,
    role: FACILITY_ROLE_LABEL[input.facilityRole],
    expiresAt: invitation.expiresAt,
    delivered,
    message: delivered ? `Invitation sent to ${input.email}.` : "Invitation saved, but email delivery failed. Configure the email provider and resend.",
  }, { status: 201 });
});
