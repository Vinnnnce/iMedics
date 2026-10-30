import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { assertPatientLinked } from "@/lib/his/access";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { OBSERVATION_TYPES, validateObservation } from "@/lib/his/nursing";

const createSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  admissionId: z.string().uuid().optional(),
  observationType: z.string().min(1).max(40),
  value: z.string().trim().min(1).max(60),
  recordedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional(),
});

// GET /api/facility/his/nursing/observations?patientId= — a patient's observation log.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const patientId = new URL(req.url).searchParams.get("patientId") ?? "";
  if (!patientId) return NextResponse.json({ observations: [] });
  await assertPatientLinked(access.facility.id, patientId);
  const observations = await prisma.nursingObservation.findMany({
    where: { facilityId: access.facility.id, patientId },
    orderBy: { recordedAt: "desc" },
    take: 100,
    include: { patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } } },
  });
  return NextResponse.json({ observations });
});

// POST /api/facility/his/nursing/observations — record a structured observation.
// The author and the clinical timestamp are captured; validation is format-only.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "RECORD_NURSING", req, ["HOSPITAL"]);
  const body = await parseBody(req, createSchema);
  await assertPatientLinked(access.facility.id, body.patientId);

  const { type, value } = validateObservation(body.observationType, body.value);
  const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date();
  if (Number.isNaN(recordedAt.getTime()) || recordedAt.getTime() > Date.now() + 60_000) {
    return NextResponse.json({ error: "The observation timestamp is not valid" }, { status: 400 });
  }

  const observation = await prisma.nursingObservation.create({
    data: {
      facilityId: access.facility.id,
      patientId: body.patientId,
      encounterId: body.encounterId ?? null,
      admissionId: body.admissionId ?? null,
      observationType: type.key,
      value,
      unit: type.unit,
      recordedAt,
      notes: body.notes ?? null,
      recordedById: user.id,
    },
  });
  await auditHis(access, "HIS_NURSING_OBSERVATION_RECORDED", "NursingObservation", observation.id, req, {
    patientId: body.patientId,
    details: { observationType: type.key, unit: type.unit, recordedAt: recordedAt.toISOString() },
  });
  return NextResponse.json({ observation, availableTypes: OBSERVATION_TYPES }, { status: 201 });
});
