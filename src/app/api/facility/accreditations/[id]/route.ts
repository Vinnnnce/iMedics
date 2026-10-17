import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess, assertSameFacility } from "@/lib/facility-auth";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  issuer: z.string().trim().min(2).max(160).optional(),
  issuedAt: z.coerce.date().nullish(),
  expiresAt: z.coerce.date().nullish(),
});

const select = { id: true, name: true, issuer: true, issuedAt: true, expiresAt: true, verified: true } as const;

// PATCH /api/facility/accreditations/[id] — the `verified` flag is set by the
// Medic1905 platform team after primary-source verification; it is not editable here.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });
  const body = await parseBody(req, patchSchema);

  const accreditation = await prisma.facilityAccreditation.findUnique({ where: { id }, select: { id: true, facilityId: true } });
  if (!accreditation) throw notFound("Accreditation not found");
  assertSameFacility(accreditation.facilityId, access.facility.id, "Accreditation");

  const updated = await prisma.facilityAccreditation.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.issuer !== undefined ? { issuer: body.issuer } : {}),
      ...(body.issuedAt !== undefined ? { issuedAt: body.issuedAt ?? null } : {}),
      ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ?? null } : {}),
    },
    select,
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_ACCREDITATION_UPDATED",
    resourceType: "FacilityAccreditation", resourceId: id,
    details: { changes: Object.keys(body) }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ accreditation: updated });
});

// DELETE /api/facility/accreditations/[id]
export const DELETE = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });

  const accreditation = await prisma.facilityAccreditation.findUnique({ where: { id }, select: { facilityId: true } });
  if (!accreditation) throw notFound("Accreditation not found");
  assertSameFacility(accreditation.facilityId, access.facility.id, "Accreditation");

  await prisma.facilityAccreditation.delete({ where: { id } });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_ACCREDITATION_DELETED",
    resourceType: "FacilityAccreditation", resourceId: id,
    details: {}, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ ok: true });
});
