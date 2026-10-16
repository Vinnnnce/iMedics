import { z } from "zod";
import { withAuth, parseQuery } from "@/lib/api";
import { findAccessiblePatient, getVerifiedDoctorProfile } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { extensionAudit, extensionsInstalled } from "@/lib/workspace/extensions";
export const GET = withAuth(["DOCTOR"], async (req, { user }) => {
  const { patientId } = parseQuery(req, z.object({ patientId: z.uuid() }));
  const doctor = await getVerifiedDoctorProfile(user);
  const patient = await findAccessiblePatient(user, patientId);
  await extensionAudit(user, "CLINICAL_CONTEXT_READ", patientId);
  const [history, consultations, results, intake] = await Promise.all([
    prisma.medicalHistory.findFirst({ where: { patientId }, orderBy: { createdAt: "desc" }, select: { chiefComplaint: true, pastHistory: true, familyHistory: true, medications: true, allergies: true } }),
    prisma.consultation.findMany({ where: { patientId, doctorId: doctor.id, status: "FINALIZED" }, orderBy: { createdAt: "desc" }, take: 5,
      select: { diagnosis: true, treatmentPlan: true, followUpDate: true, createdAt: true } }),
    prisma.labResult.findMany({ where: { patientId, status: "VERIFIED" }, orderBy: { testDate: "desc" }, take: 5,
      select: { panelType: true, testDate: true, values: { select: { code: true, name: true, value: true, unit: true, flag: true } } } }),
    await extensionsInstalled() ? prisma.$queryRaw<{ reason: string; medications: string; allergies: string; consent_at: Date }[]>`
      SELECT i.reason, i.medications, i.allergies, i.consent_at FROM workspace_intakes i
      JOIN appointments a ON a.id = i.appointment_id WHERE a.patient_id = ${patientId}::uuid
      AND a.doctor_id = ${doctor.id}::uuid ORDER BY i.consent_at DESC LIMIT 1` : Promise.resolve([]),
  ]);
  return Response.json({ patient: { id: patient.id, caseNumber: patient.caseNumber, name: `${patient.firstName} ${patient.lastName}` }, history: history ? { ...history, currentDrugs: history.medications, drugAllergies: history.allergies } : null, consultations, results, intake: intake[0] ?? null });
});
