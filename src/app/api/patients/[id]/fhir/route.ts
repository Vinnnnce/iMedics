import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { patientCaseFileFhirBundle } from "@/lib/fhir/patient-bundle";

type Params = { id: string };

// GET /api/patients/[id]/fhir — the patient's unified case file as a FHIR R4
// collection bundle. Scoped to the caller's patient access exactly like every
// other patient API, and every export is recorded in the audit trail.
export const GET = withAuth<Params>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const patient = await findAccessiblePatient(user, id);

  const [latestHistory, labResults, prescriptions, consultations, admissions] = await Promise.all([
    prisma.medicalHistory.findFirst({ where: { patientId: id }, orderBy: { createdAt: "desc" } }),
    prisma.labResult.findMany({
      where: { patientId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { values: true },
    }),
    prisma.prescription.findMany({
      where: { patientId: id },
      orderBy: { issuedAt: "desc" },
      take: 100,
      include: { items: true },
    }),
    prisma.consultation.findMany({ where: { patientId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.admission.findMany({ where: { patientId: id }, orderBy: { admissionDate: "desc" }, take: 100 }),
  ]);

  const bundle = patientCaseFileFhirBundle({
    patient,
    latestHistory,
    labResults,
    prescriptions,
    consultations,
    admissions,
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    patientId: id,
    action: "PATIENT_CASE_FILE_FHIR_EXPORTED",
    resourceType: "Patient",
    resourceId: id,
    req,
  });

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/fhir+json; charset=utf-8",
      "Content-Disposition": `attachment; filename="case-file-${patient.caseNumber}.fhir.json"`,
      "Cache-Control": "private, no-store",
    },
  });
});
