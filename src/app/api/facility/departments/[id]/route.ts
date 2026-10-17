import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess, assertSameFacility } from "@/lib/facility-auth";

const patchSchema = z.object({
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
  const access = await requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });
  const body = await parseBody(req, patchSchema);

  const department = await prisma.facilityDepartment.findUnique({ where: { id }, select: { id: true, facilityId: true } });
  if (!department) throw notFound("Department not found");
  assertSameFacility(department.facilityId, access.facility.id, "Department");

  const updated = await prisma.facilityDepartment.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description ?? null } : {}),
      ...(body.openingHours !== undefined ? { openingHours: body.openingHours ?? null } : {}),
      ...(body.equipment !== undefined ? { equipment: body.equipment } : {}),
      ...(body.leadStaffId !== undefined ? { leadStaffId: body.leadStaffId ?? null } : {}),
    },
    select,
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
  const access = await requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });

  const department = await prisma.facilityDepartment.findUnique({ where: { id }, select: { facilityId: true } });
  if (!department) throw notFound("Department not found");
  assertSameFacility(department.facilityId, access.facility.id, "Department");

  await prisma.facilityDepartment.delete({ where: { id } });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_DEPARTMENT_DELETED",
    resourceType: "FacilityDepartment", resourceId: id,
    details: {}, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ ok: true });
});
