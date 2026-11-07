import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  kind: z.string().trim().max(80).optional(),
  model: z.string().trim().max(120).optional(),
  serialNumber: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  nextServiceDueAt: z.string().date().optional(),
  notes: z.string().trim().max(500).optional(),
});

// GET /api/facility/his/lab/equipment — equipment list with maintenance status.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "ENTER_RESULTS", req, ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"]);
  const equipment = await prisma.labEquipment.findMany({
    where: { facilityId: access.facility.id },
    orderBy: { name: "asc" },
    include: {
      maintenanceLogs: { orderBy: { performedAt: "desc" }, take: 5 },
      _count: { select: { qcRuns: true } },
    },
  });
  return NextResponse.json({ equipment });
});

// POST /api/facility/his/lab/equipment — register equipment.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_HOSPITAL_SETTINGS", req, ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"]);
  const body = await parseBody(req, createSchema);
  const equipment = await prisma.labEquipment.create({
    data: {
      facilityId: access.facility.id,
      name: body.name,
      kind: body.kind ?? null,
      model: body.model ?? null,
      serialNumber: body.serialNumber ?? null,
      location: body.location ?? null,
      nextServiceDueAt: body.nextServiceDueAt ? new Date(`${body.nextServiceDueAt}T00:00:00Z`) : null,
      notes: body.notes ?? null,
    },
    select: { id: true, name: true },
  });
  await auditHis(access, "LAB_EQUIPMENT_ADDED", "LabEquipment", equipment.id, req, { details: { name: body.name } });
  return NextResponse.json({ equipment }, { status: 201 });
});
