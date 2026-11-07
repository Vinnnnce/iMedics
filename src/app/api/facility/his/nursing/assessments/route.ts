import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

/**
 * Structured nursing assessments (fall risk, pressure injury, wound care,
 * intake/output) and care plans, all linked to the central patient record.
 */

const ASSESSMENT_TYPES = ["FALL_RISK", "PRESSURE_INJURY", "WOUND_CARE", "INTAKE_OUTPUT", "GENERIC"] as const;

const assessmentSchema = z.object({
  patientId: z.string().uuid(),
  admissionId: z.string().uuid().optional(),
  type: z.enum(ASSESSMENT_TYPES),
  data: z.record(z.string(), z.unknown()),
  score: z.number().int().min(0).max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const carePlanSchema = z.object({
  patientId: z.string().uuid(),
  admissionId: z.string().uuid().optional(),
  goals: z.string().trim().min(3).max(2000),
  interventions: z.array(z.object({
    description: z.string().trim().min(1).max(500),
    frequency: z.string().trim().max(120).optional(),
  })).min(1).max(50),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]).default("ACTIVE"),
});

// GET /api/facility/his/nursing/assessments?patientId=... — history.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "RECORD_NURSING", req, ["HOSPITAL"]);
  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId");
  const type = url.searchParams.get("type");

  const [assessments, carePlans] = await Promise.all([
    prisma.nursingAssessment.findMany({
      where: {
        facilityId: access.facility.id,
        ...(patientId ? { patientId } : {}),
        ...(type ? { type: type as never } : {}),
      },
      orderBy: { assessedAt: "desc" },
      take: 200,
      select: {
        id: true, patientId: true, admissionId: true, type: true, data: true,
        score: true, notes: true, assessedAt: true,
        patient: { select: { caseNumber: true, firstName: true, lastName: true } },
        assessedBy: { select: { name: true } },
      },
    }),
    patientId
      ? prisma.nursingCarePlan.findMany({
          where: { facilityId: access.facility.id, patientId },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
  ]);
  return NextResponse.json({ assessments, carePlans });
});

// POST /api/facility/his/nursing/assessments — record an assessment.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "RECORD_NURSING", req, ["HOSPITAL"]);
  const body = await parseBody(req, assessmentSchema);

  const patient = await prisma.patient.findFirst({
    where: { id: body.patientId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) throw notFound("Patient not found");

  const assessment = await prisma.nursingAssessment.create({
    data: {
      facilityId: access.facility.id,
      patientId: body.patientId,
      admissionId: body.admissionId ?? null,
      type: body.type,
      data: body.data as object,
      score: body.score ?? null,
      notes: body.notes ?? null,
      assessedById: user.id,
    },
    select: { id: true, type: true, score: true, assessedAt: true },
  });
  await auditHis(access, "NURSING_ASSESSMENT_RECORDED", "NursingAssessment", assessment.id, req, {
    patientId: body.patientId,
    details: { type: body.type, score: body.score ?? null },
  });
  return NextResponse.json({ assessment }, { status: 201 });
});

// PUT /api/facility/his/nursing/assessments — create or update a care plan.
export const PUT = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "RECORD_NURSING", req, ["HOSPITAL"]);
  const body = await parseBody(req, carePlanSchema);

  const patient = await prisma.patient.findFirst({
    where: { id: body.patientId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) throw notFound("Patient not found");

  const plan = await prisma.nursingCarePlan.create({
    data: {
      facilityId: access.facility.id,
      patientId: body.patientId,
      admissionId: body.admissionId ?? null,
      goals: body.goals,
      interventions: body.interventions as object,
      status: body.status,
      createdById: user.id,
    },
    select: { id: true, status: true, createdAt: true },
  });
  await auditHis(access, "NURSING_CARE_PLAN_CREATED", "NursingCarePlan", plan.id, req, {
    patientId: body.patientId,
    details: { status: body.status },
  });
  return NextResponse.json({ plan }, { status: 201 });
});

const patchPlanSchema = z.object({
  planId: z.string().uuid(),
  status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]),
});

// PATCH /api/facility/his/nursing/assessments — change care-plan status.
export const PATCH = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "RECORD_NURSING", req, ["HOSPITAL"]);
  const body = await parseBody(req, patchPlanSchema);
  const plan = await prisma.nursingCarePlan.findFirst({
    where: { id: body.planId, facilityId: access.facility.id },
    select: { id: true },
  });
  if (!plan) throw notFound("Care plan not found");
  const updated = await prisma.nursingCarePlan.update({
    where: { id: body.planId },
    data: { status: body.status },
    select: { id: true, status: true },
  });
  await auditHis(access, "NURSING_CARE_PLAN_STATUS", "NursingCarePlan", body.planId, req, {
    details: { status: body.status },
  });
  return NextResponse.json({ plan: updated });
});
