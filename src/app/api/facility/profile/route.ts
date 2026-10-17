import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, conflict } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { validateFacilitySlug } from "@/lib/public-facilities";

const select = {
  addressLine: true, city: true, state: true, operatingHours: true, about: true,
  slug: true, isPublished: true, tagline: true, mission: true, vision: true,
  ownershipType: true, establishedYear: true, bedCount: true, theatreCount: true,
  laboratoryCount: true, imagingRoomCount: true, languagesSpoken: true,
  paymentMethods: true, emergencyContact: true, phone: true, email: true,
  logoUrl: true, galleryImageKeys: true,
  settlementBank: true, settlementAccountNumber: true, subaccountCode: true,
} as const;

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const schema = z.object({
  addressLine: text(200),
  city: text(100),
  state: text(100),
  operatingHours: text(200),
  about: text(4000),
  tagline: text(200),
  mission: text(500),
  vision: text(500),
  ownershipType: z.enum(["PRIVATE", "PUBLIC", "FAITH_BASED", "GROUP_PRACTICE"]).nullish(),
  establishedYear: z.coerce.number().int().min(1800).max(2100).nullish(),
  bedCount: z.coerce.number().int().min(0).max(100000).nullish(),
  theatreCount: z.coerce.number().int().min(0).max(1000).nullish(),
  laboratoryCount: z.coerce.number().int().min(0).max(1000).nullish(),
  imagingRoomCount: z.coerce.number().int().min(0).max(1000).nullish(),
  languagesSpoken: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  paymentMethods: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  emergencyContact: text(200),
  phone: text(40),
  email: z.string().trim().email().max(120).nullish(),
  logoUrl: text(500),
  galleryImageKeys: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
  slug: z.string().trim().max(80).nullish(),
  isPublished: z.boolean().optional(),
});

// GET /api/facility/profile — location, opening hours, portfolio content and publication state.
export const GET = withAuth(null, async (req, { user }) => {
  const { facility } = await requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });
  return NextResponse.json({ profile: await prisma.labStaffProfile.findUniqueOrThrow({ where: { id: facility.id }, select }) });
});

// PUT /api/facility/profile
export const PUT = withAuth(null, async (req, { user }) => {
  const { facility } = await requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });
  const data = await parseBody(req, schema);

  if (data.slug !== undefined && data.slug !== null) {
    const validated = validateFacilitySlug(data.slug);
    if (!validated) throw badRequest("Choose a slug of at least 3 letters, using letters, numbers and hyphens");
    const taken = await prisma.labStaffProfile.findFirst({ where: { slug: validated, id: { not: facility.id } }, select: { id: true } });
    if (taken) throw conflict("That web address is already taken");
    data.slug = validated;
  } else if (data.slug === null) {
    // Clearing the slug unpublishes the portfolio.
    data.isPublished = false;
  }

  // Publishing requires a slug to exist.
  if (data.isPublished && !data.slug && !facility.slug) {
    throw badRequest("Set a web address (slug) before publishing the facility page");
  }

  const updated = await prisma.labStaffProfile.update({ where: { id: facility.id }, data, select });
  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_PROFILE_UPDATED",
    resourceType: "LabStaffProfile", resourceId: facility.id,
    details: { fields: Object.keys(data) }, facilityId: facility.id, req,
  });
  return NextResponse.json({ profile: updated });
});
