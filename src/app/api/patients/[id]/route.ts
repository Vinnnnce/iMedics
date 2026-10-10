import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { findAccessiblePatient, patientScope } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { toPatientColumns, serializePatient } from "@/lib/patient";
import { serializeHistory } from "@/lib/medical-history";
import { patientInputSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";

type Params = { id: string };

// GET /api/patients/[id] — patient record with medical histories
export const GET = withAuth<Params>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const scope = await patientScope(user);

  const patient = await prisma.patient.findFirst({
    where: { AND: [{ id }, scope.where] },
    include: { medicalHistories: { orderBy: { createdAt: "desc" } } },
  });
  if (!patient) throw notFound("Patient not found");

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "PATIENT_VIEWED",
    resourceType: "Patient",
    resourceId: id,
    req,
  });

  return NextResponse.json({
    ...serializePatient(patient),
    medicalHistories: patient.medicalHistories.map(serializeHistory),
  });
});

// PUT /api/patients/[id] — update demographics (assigned doctor with an active admission, or the patient)
export const PUT = withAuth<Params>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  await findAccessiblePatient(user, id, { write: true });
  const data = await parseBody(req, patientInputSchema);

  const patient = await prisma.patient.update({ where: { id }, data: toPatientColumns(data) });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "PATIENT_UPDATED",
    resourceType: "Patient",
    resourceId: id,
    req,
  });

  return NextResponse.json(serializePatient(patient));
});
