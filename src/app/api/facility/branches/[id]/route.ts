import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess, assertSameFacility } from "@/lib/facility-auth";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  addressLine: z.string().trim().max(200).nullish(),
  city: z.string().trim().max(100).nullish(),
  state: z.string().trim().max(100).nullish(),
  phone: z.string().trim().max(40).nullish(),
  email: z.string().trim().email().max(120).nullish(),
  openingHours: z.string().trim().max(200).nullish(),
  isPrimary: z.boolean().optional(),
});

const select = { id: true, name: true, addressLine: true, city: true, state: true, phone: true, email: true, openingHours: true, isPrimary: true } as const;

// PATCH /api/facility/branches/[id]
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });
  const body = await parseBody(req, patchSchema);

  const branch = await prisma.facilityBranch.findUnique({ where: { id }, select: { id: true, facilityId: true } });
  if (!branch) throw notFound("Branch not found");
  assertSameFacility(branch.facilityId, access.facility.id, "Branch");

  const updated = await prisma.facilityBranch.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.addressLine !== undefined ? { addressLine: body.addressLine ?? null } : {}),
      ...(body.city !== undefined ? { city: body.city ?? null } : {}),
      ...(body.state !== undefined ? { state: body.state ?? null } : {}),
      ...(body.phone !== undefined ? { phone: body.phone ?? null } : {}),
      ...(body.email !== undefined ? { email: body.email ?? null } : {}),
      ...(body.openingHours !== undefined ? { openingHours: body.openingHours ?? null } : {}),
      ...(body.isPrimary !== undefined ? { isPrimary: body.isPrimary } : {}),
    },
    select,
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_BRANCH_UPDATED",
    resourceType: "FacilityBranch", resourceId: id,
    details: { changes: Object.keys(body) }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ branch: updated });
});

// DELETE /api/facility/branches/[id]
export const DELETE = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });

  const branch = await prisma.facilityBranch.findUnique({ where: { id }, select: { facilityId: true } });
  if (!branch) throw notFound("Branch not found");
  assertSameFacility(branch.facilityId, access.facility.id, "Branch");

  await prisma.facilityBranch.delete({ where: { id } });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_BRANCH_DELETED",
    resourceType: "FacilityBranch", resourceId: id,
    details: {}, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ ok: true });
});
