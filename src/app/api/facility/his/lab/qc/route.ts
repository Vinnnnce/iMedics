import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const createSchema = z.object({
  equipmentId: z.string().uuid().optional(),
  testName: z.string().trim().max(160).optional(),
  controlName: z.string().trim().min(1).max(160),
  expected: z.string().trim().max(60).optional(),
  observed: z.string().trim().min(1).max(60),
  result: z.enum(["PASS", "FAIL", "WARNING"]),
  performedAt: z.string().date().optional(),
  notes: z.string().trim().max(500).optional(),
});

// GET /api/facility/his/lab/qc — quality-control run history.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "ENTER_RESULTS", req, ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"]);
  const runs = await prisma.labQualityControlRun.findMany({
    where: { facilityId: access.facility.id },
    orderBy: { performedAt: "desc" },
    take: 200,
    select: {
      id: true, testName: true, controlName: true, expected: true, observed: true,
      result: true, performedAt: true, notes: true,
      equipment: { select: { id: true, name: true } },
      performedBy: { select: { name: true } },
    },
  });
  return NextResponse.json({ runs });
});

// POST /api/facility/his/lab/qc — record a QC run.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "ENTER_RESULTS", req, ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"]);
  const body = await parseBody(req, createSchema);

  if (body.equipmentId) {
    const equipment = await prisma.labEquipment.findFirst({
      where: { id: body.equipmentId, facilityId: access.facility.id },
      select: { id: true },
    });
    if (!equipment) throw notFound("Equipment not found");
  }
  if (body.result === "FAIL" && !body.notes) {
    throw badRequest("A failed QC run requires an explanatory note");
  }

  const run = await prisma.labQualityControlRun.create({
    data: {
      facilityId: access.facility.id,
      equipmentId: body.equipmentId ?? null,
      testName: body.testName ?? null,
      controlName: body.controlName,
      expected: body.expected ?? null,
      observed: body.observed,
      result: body.result,
      performedAt: body.performedAt ? new Date(`${body.performedAt}T00:00:00Z`) : new Date(),
      performedById: user.id,
      notes: body.notes ?? null,
    },
    select: { id: true, result: true },
  });
  await auditHis(access, "LAB_QC_RUN_RECORDED", "LabQualityControlRun", run.id, req, {
    details: { controlName: body.controlName, result: body.result },
  });
  return NextResponse.json({ run }, { status: 201 });
});
