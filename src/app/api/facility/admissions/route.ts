import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { badRequest, conflict } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const listSchema = z.object({
  status: z.enum(["ACTIVE", "DISCHARGED", "TRANSFERRED", "CANCELLED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/facility/admissions — the hospital's admission list (Module 01).
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const { status, limit } = parseQuery(req, listSchema);

  const admissions = await prisma.admission.findMany({
    where: { facilityId: access.facility.id, ...(status ? { status } : {}) },
    orderBy: [{ admissionDate: "desc" }],
    take: limit,
    select: {
      id: true,
      status: true,
      ward: true,
      bed: true,
      admissionDate: true,
      dischargeDate: true,
      workingDiagnosis: true,
      diagnosisCode: true,
      diagnosisName: true,
      patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true, gender: true, dateOfBirth: true } },
      admittingDoctor: { select: { specialty: true, user: { select: { name: true } } } },
      _count: { select: { notes: true } },
    },
  });

  return NextResponse.json({ admissions });
});

const createSchema = z.object({
  patientId: z.string().uuid(),
  caseId: z.string().uuid().optional(),
  admittingDoctorId: z.string().uuid().optional(),
  ward: z.string().trim().min(1).max(100).optional(),
  bed: z.string().trim().min(1).max(50).optional(),
  admissionDate: z.coerce.date(),
  reason: z.string().trim().min(1).max(2000),
  initialAssessment: z.string().trim().max(5000).optional(),
  workingDiagnosis: z.string().trim().max(1000).optional(),
  diagnosisCode: z.string().trim().max(20).optional(),
  diagnosisName: z.string().trim().max(300).optional(),
});

// POST /api/facility/admissions — register a hospital admission (Module 01, Category 01/03).
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const data = await parseBody(req, createSchema);

  const patient = await prisma.patient.findFirst({
    where: { id: data.patientId, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!patient) throw badRequest("Patient not found");

  // Prevent duplicate active episodes for the same patient in this hospital.
  const existing = await prisma.admission.findFirst({
    where: { facilityId: access.facility.id, patientId: data.patientId, status: "ACTIVE" },
    select: { id: true },
  });
  if (existing) throw conflict("This patient already has an active admission in your facility");

  let careCaseId = data.caseId ?? null;
  if (careCaseId) {
    // The linked case must belong to this patient — never accept a case id
    // from another patient's record.
    const careCase = await prisma.careCase.findFirst({
      where: { id: careCaseId, patientId: data.patientId },
      select: { id: true },
    });
    if (!careCase) throw badRequest("The selected case does not belong to this patient");
  } else {
    const careCase = await prisma.careCase.findFirst({
      where: { patientId: data.patientId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    careCaseId = careCase?.id ?? null;
  }

  const admission = await prisma.admission.create({
    data: {
      status: "ACTIVE",
      patientId: data.patientId,
      facilityId: access.facility.id,
      caseId: careCaseId,
      admittingDoctorId: data.admittingDoctorId ?? null,
      ward: data.ward ?? null,
      bed: data.bed ?? null,
      admissionDate: data.admissionDate,
      reason: data.reason,
      initialAssessment: data.initialAssessment ?? null,
      workingDiagnosis: data.workingDiagnosis ?? null,
      diagnosisCode: data.diagnosisCode ?? null,
      diagnosisName: data.diagnosisName ?? null,
    },
    select: { id: true, status: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "ADMISSION_CREATED",
    resourceType: "Admission",
    resourceId: admission.id,
    details: { facilityId: access.facility.id, patientId: data.patientId, ward: data.ward ?? null },
    req,
  });

  return NextResponse.json({ success: true, id: admission.id, admission }, { status: 201 });
});
