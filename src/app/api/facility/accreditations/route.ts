import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess } from "@/lib/facility-auth";

const select = { id: true, name: true, issuer: true, issuedAt: true, expiresAt: true, verified: true } as const;

// GET /api/facility/accreditations
export const GET = withAuth(null, async (req, { user }) => {
  const { facility } = await requireFacilityAccess(user, null, req, { requireVerified: false });
  const accreditations = await prisma.facilityAccreditation.findMany({ where: { facilityId: facility.id }, orderBy: [{ name: "asc" }], select });
  return NextResponse.json({ accreditations });
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(160),
  issuer: z.string().trim().min(2).max(160),
  issuedAt: z.coerce.date().nullish(),
  expiresAt: z.coerce.date().nullish(),
});

// POST /api/facility/accreditations — record an accreditation. The public
// "verified" badge is only shown after Medic1905 verifies the document.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });
  const input = await parseBody(req, createSchema);

  const accreditation = await prisma.facilityAccreditation.create({
    data: {
      facilityId: access.facility.id,
      name: input.name,
      issuer: input.issuer,
      issuedAt: input.issuedAt ?? null,
      expiresAt: input.expiresAt ?? null,
    },
    select,
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_ACCREDITATION_CREATED",
    resourceType: "FacilityAccreditation", resourceId: accreditation.id,
    details: { name: input.name }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ accreditation }, { status: 201 });
});
