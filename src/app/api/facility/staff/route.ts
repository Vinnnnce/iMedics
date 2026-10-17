import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { FACILITY_ROLE_LABEL } from "@/lib/facility-staff";
import { createStaffInvitation, sendStaffInvitationEmail } from "@/lib/facility-invitations";

const inviteSchema = z.object({
  email: z.string().trim().email().max(120),
  fullName: z.string().trim().min(2).max(120),
  facilityRole: z.enum(["FACILITY_MANAGER", "DOCTOR", "LAB_SCIENTIST", "LAB_TECHNICIAN", "LAB_ASSISTANT", "PHLEBOTOMIST", "NURSE", "RADIOGRAPHER", "RECEPTIONIST", "ACCOUNTANT", "COMPLIANCE_OFFICER"]),
  departmentId: z.string().uuid().nullish(),
  branchId: z.string().uuid().nullish(),
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

  const invitation = await createStaffInvitation({
    facilityId: access.facility.id,
    email: input.email,
    fullName: input.fullName,
    facilityRole: input.facilityRole,
    departmentId: input.departmentId ?? null,
    branchId: input.branchId ?? null,
    invitedById: user.id,
  });

  await sendStaffInvitationEmail({
    to: input.email,
    facilityName: access.facility.laboratoryName ?? "your facility",
    redeemUrl: invitation.redeemUrl,
    inviterName: user.name,
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_STAFF_INVITED",
    resourceType: "FacilityStaff", resourceId: invitation.staffId,
    details: { role: input.facilityRole, email: input.email }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({
    staffId: invitation.staffId,
    role: FACILITY_ROLE_LABEL[input.facilityRole],
    expiresAt: invitation.expiresAt,
    message: `Invitation sent to ${input.email}. It expires in 7 days and can be used once.`,
  }, { status: 201 });
});
