import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, parseQuery, parseBody } from "@/lib/api";
import { searchMedicationReference } from "@/lib/prescriptions/reference";
import { createPrescriptionSchema } from "@/lib/prescriptions/validation";
import { loadPatientSafetyContext, runPrescriptionSafetyChecks } from "@/lib/prescriptions/safety";
import { findAccessiblePatient } from "@/lib/access";
import { getMedicationReference } from "@/lib/prescriptions/reference";

const searchQuery = z.object({ q: z.string().trim().min(2).max(100) });

// GET /api/medications?q= — search the curated medication reference.
export const GET = withAuth(["DOCTOR", "ADMIN"], async (req, { user }) => {
  void user;
  const { q } = parseQuery(req, searchQuery);
  const results = await searchMedicationReference(q);
  return NextResponse.json({ medications: results });
});

const safetySchema = createPrescriptionSchema.pick({ patientId: true, items: true });

// POST /api/medications/safety — run the server-side safety checks for a draft
// prescription (allergies, duplicates, interactions, patient considerations).
export const POST = withAuth(["DOCTOR", "ADMIN"], async (req: NextRequest, { user }) => {
  const body = await parseBody(req, safetySchema);
  const patient = await findAccessiblePatient(user, body.patientId);

  const context = await loadPatientSafetyContext(patient.id);
  const referenceByDrug = new Map<string, { rxCui: string | null; drugClass: string | null }>();
  for (const item of body.items) {
    const ref = item.medicationRefId ? await getMedicationReference(item.medicationRefId) : null;
    referenceByDrug.set(item.drugName, { rxCui: ref?.rxCui ?? null, drugClass: ref?.drugClass ?? item.drugClass ?? null });
  }
  const alerts = await runPrescriptionSafetyChecks(context, body.items, referenceByDrug);
  return NextResponse.json({ alerts, context: { allergies: context.allergies, currentMedications: context.currentMedicationNames } });
});
