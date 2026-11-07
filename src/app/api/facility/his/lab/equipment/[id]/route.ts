import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const patchSchema = z.object({
  action: z.enum(["SET_STATUS", "LOG_MAINTENANCE"]),
  status: z.enum(["OPERATIONAL", "MAINTENANCE", "OUT_OF_SERVICE"]).optional(),
  maintenanceType: z.enum(["PREVENTIVE", "CORRECTIVE", "CALIBRATION"]).optional(),
  downtimeHours: z.number().min(0).max(1000).optional(),
  performedAt: z.string().date().optional(),
  notes: z.string().trim().max(1000).optional(),
});

// PATCH /api/facility/his/lab/equipment/[id] — status or maintenance log entry.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "ENTER_RESULTS", req, ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"]);
  const id = parseId((await params).id);
  const equipment = await prisma.labEquipment.findFirst({ where: { id, facilityId: access.facility.id } });
  if (!equipment) throw notFound("Equipment not found");
  const body = await parseBody(req, patchSchema);

  if (body.action === "SET_STATUS") {
    if (!body.status) throw badRequest("status is required");
    await prisma.labEquipment.update({
      where: { id },
      data: { status: body.status, ...(body.status === "OPERATIONAL" ? { lastServicedAt: new Date() } : {}) },
    });
  } else {
    if (!body.maintenanceType) throw badRequest("maintenanceType is required");
    const performedAt = body.performedAt ? new Date(`${body.performedAt}T00:00:00Z`) : new Date();
    await prisma.$transaction(async (tx) => {
      await tx.labEquipmentMaintenanceLog.create({
        data: {
          equipmentId: id,
          type: body.maintenanceType!,
          performedAt,
          performedById: user.id,
          downtimeHours: body.downtimeHours ?? null,
          notes: body.notes ?? null,
        },
      });
      await tx.labEquipment.update({
        where: { id },
        data: { status: "OPERATIONAL", lastServicedAt: performedAt },
      });
    });
  }

  await auditHis(access, "LAB_EQUIPMENT_UPDATED", "LabEquipment", id, req, {
    details: { action: body.action, status: body.status ?? null, maintenanceType: body.maintenanceType ?? null },
  });
  const updated = await prisma.labEquipment.findUniqueOrThrow({ where: { id } });
  return NextResponse.json({ equipment: updated });
});
