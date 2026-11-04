import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess, assertSameFacility } from "@/lib/facility-auth";
import { validateOrganizationLinks, assertAcyclic, controlAudit } from "@/lib/organization/security";

const patchSchema = z.object({
  code: z.string().trim().min(1).max(30).nullish(),
  parentId: z.string().uuid().nullish(),
  deputyStaffId: z.string().uuid().nullish(),
  active: z.boolean().optional(),
  imageUrl: z.string().url().max(500).nullish(),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullish(),
  openingHours: z.string().trim().max(200).nullish(),
  equipment: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  leadStaffId: z.string().uuid().nullish(),
});

const select = { id: true, name: true, slug: true, description: true, openingHours: true, equipment: true, leadStaffId: true } as const;

// PATCH /api/facility/departments/[id]
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req, { requireVerified: false });
  const body = await parseBody(req, patchSchema);

  const department = await prisma.facilityDepartment.findUnique({ where: { id }, select: { id: true, facilityId: true } });
  if (!department) throw notFound("Department not found");
  assertSameFacility(department.facilityId, access.facility.id, "Department");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${access.facility.id}))::text`;
    const current = await tx.facilityDepartment.findFirstOrThrow({ where: { id, facilityId: access.facility.id } });
    await validateOrganizationLinks(tx, access.facility.id, { ...current, ...body });
    if (body.parentId !== undefined) assertAcyclic(id, body.parentId ?? null, await tx.facilityDepartment.findMany({ where: { facilityId: access.facility.id }, select: { id: true, parentId: true } }));
    const row = await tx.facilityDepartment.update({
    where: { id },
    data: {
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
      ...(body.deputyStaffId !== undefined ? { deputyStaffId: body.deputyStaffId } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description ?? null } : {}),
      ...(body.openingHours !== undefined ? { openingHours: body.openingHours ?? null } : {}),
      ...(body.equipment !== undefined ? { equipment: body.equipment } : {}),
      ...(body.leadStaffId !== undefined ? { leadStaffId: body.leadStaffId ?? null } : {}),
    },
    select,
    });
    await controlAudit(tx, user.id, access.facility.id, "FACILITY_DEPARTMENT_UPDATED", id, { changes: Object.keys(body) });
    return row;
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_DEPARTMENT_UPDATED",
    resourceType: "FacilityDepartment", resourceId: id,
    details: { changes: Object.keys(body) }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ department: updated });
});

// DELETE /api/facility/departments/[id]
export const DELETE = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req, { requireVerified: false });

  const department = await prisma.facilityDepartment.findUnique({ where: { id }, select: { facilityId: true } });
  if (!department) throw notFound("Department not found");
  assertSameFacility(department.facilityId, access.facility.id, "Department");

  await prisma.$transaction(async (tx) => {
    await tx.facilityDepartment.update({ where: { id }, data: { active: false } });
    await controlAudit(tx, user.id, access.facility.id, "FACILITY_DEPARTMENT_DEACTIVATED", id, {});
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_DEPARTMENT_DEACTIVATED",
    resourceType: "FacilityDepartment", resourceId: id,
    details: {}, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ ok: true });
});
