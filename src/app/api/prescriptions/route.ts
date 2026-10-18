import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { getVerifiedDoctorProfile, findAccessiblePatient } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { createPrescriptionSchema } from "@/lib/prescriptions/validation";
import { loadPatientSafetyContext, runPrescriptionSafetyChecks } from "@/lib/prescriptions/safety";
import { getMedicationReference } from "@/lib/prescriptions/reference";

/**
 * Structured prescriptions.
 * - POST: a verified doctor creates a prescription for an assigned patient.
 *   Safety checks run server-side; high alerts require the prescriber's
 *   explicit acknowledgement, which is stored with the prescription.
 * - GET: doctors list prescriptions for an assigned patient; patients list
 *   their own.
 */

const listQuery = z.object({ patientId: z.string().uuid() });

export const GET = withAuth(["DOCTOR", "PATIENT"], async (req, { user }) => {
  const { patientId } = parseQuery(req, listQuery);
  await findAccessiblePatient(user, patientId);
  const prescriptions = await prisma.prescription.findMany({
    where: { patientId },
    orderBy: { issuedAt: "desc" },
    take: 50,
    include: {
      items: { orderBy: { sortOrder: "asc" } },
      doctor: { include: { user: { select: { name: true } } } },
    },
  });
  return NextResponse.json({ prescriptions });
});

export const POST = withAuth(["DOCTOR"], async (req: NextRequest, { user }) => {
  const body = await parseBody(req, createPrescriptionSchema);
  const doctor = await getVerifiedDoctorProfile(user);
  const patient = await findAccessiblePatient(user, body.patientId, { write: true });

  // Run the safety checks server-side regardless of what the client computed.
  const context = await loadPatientSafetyContext(patient.id);
  const referenceByDrug = new Map<string, { rxCui: string | null; drugClass: string | null }>();
  for (const item of body.items) {
    const ref = item.medicationRefId ? await getMedicationReference(item.medicationRefId) : null;
    referenceByDrug.set(item.drugName, { rxCui: ref?.rxCui ?? null, drugClass: ref?.drugClass ?? item.drugClass ?? null });
  }
  const alerts = await runPrescriptionSafetyChecks(context, body.items, referenceByDrug);
  const highAlerts = alerts.filter((a) => a.severity === "HIGH");

  if (highAlerts.length > 0 && !body.safetyAcknowledged) {
    return NextResponse.json(
      { error: "Review and confirm the safety alerts before issuing this prescription.", alerts },
      { status: 422 },
    );
  }

  const prescription = await prisma.prescription.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      consultationId: body.consultationId,
      caseId: body.caseId,
      notes: body.notes,
      validUntil: body.validUntil,
      status: "ACTIVE",
      safetyReviewedAt: new Date(),
      safetyReviewNotes: JSON.parse(JSON.stringify({ alerts, acknowledged: body.safetyAcknowledged })) as object,
      items: {
        create: body.items.map((item, index) => ({
          sortOrder: index,
          drugName: item.drugName,
          activeIngredient: item.activeIngredient,
          drugClass: item.drugClass,
          pharmacologicalClass: item.pharmacologicalClass,
          antibioticClass: item.antibioticClass,
          antimicrobialSpectrum: item.antimicrobialSpectrum,
          coverageNotes: item.coverageNotes,
          indication: item.indication,
          route: item.route,
          formulation: item.formulation,
          strength: item.strength,
          doseValue: item.doseValue,
          doseUnit: item.doseUnit,
          dose: item.doseValue != null ? `${item.doseValue} ${item.doseUnit ?? ""}`.trim() : undefined,
          frequency: item.frequency,
          frequencyText: item.frequencyText,
          schedule: item.schedule,
          duration: item.duration,
          startDate: item.startDate,
          endDate: item.endDate,
          quantity: item.quantity,
          refills: item.refills ?? 0,
          foodInstructions: item.foodInstructions,
          missedDoseInstructions: item.missedDoseInstructions,
          precautions: item.precautions,
          monitoring: item.monitoring,
          instructions: item.instructions,
          medicationRefId: item.medicationRefId,
          clinicalOverrideNotes: item.clinicalOverrideNotes,
        })),
      },
    },
    include: { items: true },
  });

  await writeAudit({
    userId: user.id,
    patientId: patient.id,
    actorRole: user.role,
    action: "PRESCRIPTION_CREATED",
    resourceType: "Prescription",
    resourceId: prescription.id,
    details: { items: prescription.items.length, highAlerts: highAlerts.length },
    req,
  });

  return NextResponse.json({ prescription, alerts }, { status: 201 });
});
