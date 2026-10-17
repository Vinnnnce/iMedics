import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess } from "@/lib/facility-auth";

const select = {
  id: true, fullName: true, email: true, facilityRole: true, status: true,
  department: { select: { name: true } }, branch: { select: { name: true } },
  professionalTitle: true, qualifications: true, specialty: true, yearsExperience: true,
  bio: true, photoUrl: true, languages: true, linkedinUrl: true, linkedinPublic: true,
  publicProfileVisible: true, profileConsent: true, bookingEligible: true,
} as const;

// GET /api/facility/staff/me — the signed-in staff member's own profile.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, null, req, { requireVerified: false });
  const staff = await prisma.facilityStaff.findUnique({ where: { id: access.staffId }, select });
  if (!staff) throw notFound("Staff profile not found");
  return NextResponse.json({ staff, facilityName: access.facility.laboratoryName });
});

const patchSchema = z.object({
  professionalTitle: z.string().trim().max(120).nullish(),
  qualifications: z.string().trim().max(500).nullish(),
  specialty: z.string().trim().max(200).nullish(),
  yearsExperience: z.coerce.number().int().min(0).max(70).nullish(),
  bio: z.string().trim().max(1000).nullish(),
  photoUrl: z.string().trim().max(500).nullish(),
  languages: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  linkedinUrl: z.string().trim().url().max(300).nullish(),
  linkedinPublic: z.boolean().optional(),
  /** The staff member's own consent to appear on the public facility portfolio. */
  profileConsent: z.boolean().optional(),
});

// PATCH /api/facility/staff/me — update your own staff profile and consent.
// Facility-wide settings (role, visibility switch, booking eligibility) are not
// editable here; only the staff member's own fields and consent.
export const PATCH = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, null, req, { requireVerified: false });
  const body = await parseBody(req, patchSchema);

  const data: Record<string, unknown> = {};
  for (const key of ["professionalTitle", "qualifications", "specialty", "yearsExperience", "bio", "photoUrl", "languages", "linkedinUrl", "linkedinPublic"] as const) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.profileConsent !== undefined) {
    data.profileConsent = body.profileConsent;
    data.profileConsentAt = body.profileConsent ? new Date() : null;
  }

  const staff = await prisma.facilityStaff.update({ where: { id: access.staffId }, data, select });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_STAFF_SELF_UPDATED",
    resourceType: "FacilityStaff", resourceId: access.staffId,
    details: { changes: Object.keys(data) }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ staff });
});
