import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().max(40).nullish(),
  departmentId: z.string().uuid().nullish(),
  genderPolicy: z.enum(["MALE", "FEMALE", "MIXED", "PEDIATRIC", "ISOLATION"]).nullish(),
  notes: z.string().trim().max(500).nullish(),
});

// PATCH /api/facility/his/wards/[id] — update ward details.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const ward = await prisma.ward.findFirst({ where: { id, facilityId: access.facility.id } });
  if (!ward) throw notFound("Ward not found");
  const body = await parseBody(req, patchSchema);

  const updated = await prisma.ward.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.code !== undefined ? { code: body.code } : {}),
      ...(body.departmentId !== undefined ? { departmentId: body.departmentId } : {}),
      ...(body.genderPolicy !== undefined ? { genderPolicy: body.genderPolicy } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
    select: { id: true, name: true },
  });
  await auditHis(access, "WARD_UPDATED", "Ward", id, req, { details: { changes: body } });
  return NextResponse.json({ ward: updated });
});

// DELETE /api/facility/his/wards/[id] — delete an empty ward.
export const DELETE = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const ward = await prisma.ward.findFirst({
    where: { id, facilityId: access.facility.id },
    include: { beds: { where: { status: { in: ["OCCUPIED", "RESERVED"] } }, select: { id: true } } },
  });
  if (!ward) throw notFound("Ward not found");
  if (ward.beds.length > 0) {
    throw conflict("Cannot delete a ward with occupied or reserved beds");
  }
  await prisma.ward.delete({ where: { id } });
  await auditHis(access, "WARD_DELETED", "Ward", id, req, { details: { name: ward.name } });
  return NextResponse.json({ ok: true });
});

const bedSchema = z.object({
  labels: z.array(z.string().trim().min(1).max(20)).min(1).max(200),
});

// POST /api/facility/his/wards/[id] — add beds to a ward (bulk by label).
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const ward = await prisma.ward.findFirst({ where: { id, facilityId: access.facility.id }, select: { id: true, name: true } });
  if (!ward) throw notFound("Ward not found");
  const body = await parseBody(req, bedSchema);
  if (new Set(body.labels).size !== body.labels.length) throw badRequest("Bed labels must be unique");

  const created = await prisma.$transaction(async (tx) => {
    const rows: { id: string; label: string }[] = [];
    for (const label of body.labels) {
      const bed = await tx.bed.create({
        data: { facilityId: access.facility.id, wardId: id, label },
        select: { id: true, label: true },
      });
      rows.push(bed);
    }
    return rows;
  });
  await auditHis(access, "BEDS_ADDED", "Ward", id, req, { details: { count: created.length } });
  return NextResponse.json({ beds: created }, { status: 201 });
});
