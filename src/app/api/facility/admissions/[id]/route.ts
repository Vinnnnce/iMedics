import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { admissionIsEditable, ADMISSION_STATUS_LABEL } from "@/lib/modules/workflows";
import { badRequest, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

// GET /api/facility/admissions/[id] — admission detail (hospital staff only).
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const id = parseId((await params).id);

  const admission = await prisma.admission.findFirst({
    where: { id, facilityId: access.facility.id },
    select: {
      id: true, status: true, ward: true, bed: true, admissionDate: true, reason: true,
      initialAssessment: true, workingDiagnosis: true, diagnosisCode: true, diagnosisName: true,
      dischargeDate: true, disposition: true, finalDiagnosisCode: true, finalDiagnosisName: true,
      outcome: true, epicrisis: true, medicationInstructions: true, followUpInstructions: true,
      transferredToFacilityId: true, transferSummary: true, createdAt: true,
      patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true, gender: true, dateOfBirth: true } },
      admittingDoctor: { select: { id: true, specialty: true, user: { select: { name: true } } } },
      notes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, content: true, vitals: true, createdAt: true, author: { select: { id: true, name: true } } },
      },
      wardTransfers: {
        orderBy: { transferredAt: "desc" },
        select: { id: true, fromWard: true, toWard: true, reason: true, transferredAt: true, actor: { select: { name: true } } },
      },
    },
  });
  if (!admission) throw notFound("Admission not found");

  return NextResponse.json({ admission });
});

const patchSchema = z.object({
  ward: z.string().trim().min(1).max(100).optional(),
  bed: z.string().trim().min(1).max(50).optional(),
  initialAssessment: z.string().trim().max(5000).nullable().optional(),
  workingDiagnosis: z.string().trim().max(1000).nullable().optional(),
  diagnosisCode: z.string().trim().max(20).nullable().optional(),
  diagnosisName: z.string().trim().max(300).nullable().optional(),
  reason: z.string().trim().max(2000).optional(),
});

// PATCH /api/facility/admissions/[id] — update an ACTIVE admission's details.
// Closed episodes are immutable: the discharge/transfer record stands as issued.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const data = await parseBody(req, patchSchema);

  const admission = await prisma.admission.findFirst({
    where: { id, facilityId: access.facility.id },
    select: { id: true, status: true },
  });
  if (!admission) throw notFound("Admission not found");
  if (!admissionIsEditable(admission.status)) {
    throw badRequest(`A ${ADMISSION_STATUS_LABEL[admission.status].toLowerCase()} admission can no longer be edited`);
  }

  const updated = await prisma.admission.update({
    where: { id },
    data: {
      ...(data.ward !== undefined ? { ward: data.ward } : {}),
      ...(data.bed !== undefined ? { bed: data.bed } : {}),
      ...(data.initialAssessment !== undefined ? { initialAssessment: data.initialAssessment } : {}),
      ...(data.workingDiagnosis !== undefined ? { workingDiagnosis: data.workingDiagnosis } : {}),
      ...(data.diagnosisCode !== undefined ? { diagnosisCode: data.diagnosisCode } : {}),
      ...(data.diagnosisName !== undefined ? { diagnosisName: data.diagnosisName } : {}),
      ...(data.reason !== undefined ? { reason: data.reason } : {}),
    },
    select: { id: true, status: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "ADMISSION_UPDATED",
    resourceType: "Admission",
    resourceId: id,
    details: { fields: Object.keys(data) },
    req,
  });

  return NextResponse.json({ success: true, admission: updated });
});
