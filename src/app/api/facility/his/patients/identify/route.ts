import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { findPatientByIdentity, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const schema = z.object({
  caseNumber: z.string().trim().min(6).max(30),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});

// POST /api/facility/his/patients/identify — safe identity verification: the
// exact case number AND date of birth must both match. Never fuzzy-matches names.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "REGISTER_PATIENTS", req);
  const { caseNumber, dateOfBirth } = await parseBody(req, schema);
  const patient = await findPatientByIdentity(caseNumber, dateOfBirth);
  await auditHis(access, "HIS_PATIENT_IDENTIFY", "Patient", patient?.id ?? null, req, { patientId: patient?.id ?? null, details: { found: Boolean(patient) } });
  if (!patient) throw notFound("No patient matches that case number and date of birth");
  return NextResponse.json({ patient: { id: patient.id, caseNumber: patient.caseNumber, firstName: patient.firstName, lastName: patient.lastName, gender: patient.gender, dateOfBirth: patient.dateOfBirth } });
});
