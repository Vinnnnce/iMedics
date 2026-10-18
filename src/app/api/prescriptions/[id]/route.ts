import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile, findAccessiblePatient } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { loadPatientSafetyContext, runPrescriptionSafetyChecks } from "@/lib/prescriptions/safety";
import { getMedicationReference } from "@/lib/prescriptions/reference";
import type { PrescriptionItemInput } from "@/lib/prescriptions/validation";
import { ensureReminderForPrescriptionItem } from "@/lib/medication-reminders";

const actionSchema = z.object({
  action: z.enum(["CANCEL", "RENEW"]),
  reason: z.string().trim().max(500).optional(),
  validUntil: z.coerce.date().optional(),
});

/** Only the issuing doctor (or an admin) may cancel or renew a prescription. */
export const PATCH = withAuth<{ id: string }>(["DOCTOR", "ADMIN"], async (req: NextRequest, { params, user }) => {
  const { id } = await params;
  const body = await parseBody(req, actionSchema);

  const prescription = await prisma.prescription.findUnique({ where: { id }, include: { items: true } });
  if (!prescription) return NextResponse.json({ error: "Prescription not found" }, { status: 404 });

  if (user.role === "DOCTOR") {
    const doctor = await getVerifiedDoctorProfile(user);
    if (prescription.doctorId !== doctor.id) {
      return NextResponse.json({ error: "Only the issuing doctor can modify this prescription" }, { status: 403 });
    }
  }
  await findAccessiblePatient(user, prescription.patientId, { write: true });

  if (body.action === "CANCEL") {
    const updated = await prisma.prescription.update({
      where: { id },
      data: { status: "DISCONTINUED" as const, notes: [prescription.notes, body.reason ? `Cancelled: ${body.reason}` : "Cancelled"].filter(Boolean).join("\n") },
    });
    // Deactivate the medication reminders linked to this prescription's items
    // and drop any not-yet-due dose events. Doses already recorded keep their
    // history for adherence summaries.
    const itemIds = prescription.items.map((item) => item.id);
    if (itemIds.length > 0) {
      const now = new Date();
      await prisma.medicationReminder.updateMany({
        where: { prescriptionItemId: { in: itemIds }, active: true },
        data: { active: false, endDate: now },
      });
      await prisma.doseEvent.deleteMany({
        where: {
          reminder: { prescriptionItemId: { in: itemIds } },
          status: "SCHEDULED",
          scheduledFor: { gt: now },
        },
      });
    }
    await writeAudit({
      userId: user.id, patientId: prescription.patientId, actorRole: user.role,
      action: "PRESCRIPTION_CANCELLED", resourceType: "Prescription", resourceId: id,
      details: { reason: body.reason ?? null }, req,
    });
    return NextResponse.json({ prescription: updated });
  }

  // Renew: issue a fresh ACTIVE prescription carrying the same items.
  // Dates restart from today (the old start/end dates are never copied over),
  // and the safety checks are re-run server-side against the patient's CURRENT
  // context — allergies may have changed since the original was issued.
  const now = new Date();
  const renewedItems = prescription.items.map((item) => ({
    sortOrder: item.sortOrder,
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
    dose: item.dose,
    frequency: item.frequency as PrescriptionItemInput["frequency"],
    frequencyText: item.frequencyText,
    schedule: item.schedule,
    duration: item.duration,
    startDate: now,
    endDate: null,
    quantity: item.quantity,
    refills: item.refills,
    foodInstructions: item.foodInstructions,
    missedDoseInstructions: item.missedDoseInstructions,
    precautions: item.precautions,
    monitoring: item.monitoring,
    instructions: item.instructions,
    medicationRefId: item.medicationRefId,
    clinicalOverrideNotes: item.clinicalOverrideNotes,
  }));
  const renewed = await prisma.prescription.create({
    data: {
      patientId: prescription.patientId,
      doctorId: prescription.doctorId,
      consultationId: prescription.consultationId,
      caseId: prescription.caseId,
      notes: `Renewed from prescription ${prescription.id}${body.reason ? `: ${body.reason}` : ""}`,
      validUntil: body.validUntil,
      items: { create: renewedItems },
    },
    include: { items: true },
  });

  // Fresh safety review against the patient's current record.
  const context = await loadPatientSafetyContext(prescription.patientId);
  const referenceByDrug = new Map<string, { rxCui: string | null; drugClass: string | null }>();
  for (const item of renewed.items) {
    const ref = item.medicationRefId ? await getMedicationReference(item.medicationRefId) : null;
    referenceByDrug.set(item.drugName, { rxCui: ref?.rxCui ?? null, drugClass: ref?.drugClass ?? item.drugClass ?? null });
  }
  const alerts = await runPrescriptionSafetyChecks(context, renewed.items.map((item) => ({
    drugName: item.drugName,
    activeIngredient: item.activeIngredient ?? undefined,
    drugClass: item.drugClass ?? undefined,
    antibioticClass: item.antibioticClass ?? undefined,
    antimicrobialSpectrum: (item.antimicrobialSpectrum as string[]) ?? [],
    indication: item.indication ?? undefined,
    route: (item.route ?? undefined) as PrescriptionItemInput["route"],
    formulation: item.formulation ?? undefined,
    strength: item.strength ?? undefined,
    dose: item.dose ?? undefined,
    doseValue: item.doseValue ?? undefined,
    doseUnit: (item.doseUnit ?? undefined) as PrescriptionItemInput["doseUnit"],
    frequency: item.frequency as PrescriptionItemInput["frequency"],
    frequencyText: item.frequencyText ?? undefined,
    schedule: (item.schedule as string[]) ?? [],
    duration: item.duration ?? undefined,
    startDate: now,
    endDate: undefined,
    foodInstructions: item.foodInstructions ?? undefined,
    missedDoseInstructions: item.missedDoseInstructions ?? undefined,
    precautions: item.precautions ?? undefined,
    monitoring: item.monitoring ?? undefined,
    instructions: item.instructions ?? undefined,
    medicationRefId: item.medicationRefId ?? undefined,
    clinicalOverrideNotes: item.clinicalOverrideNotes ?? undefined,
  })), referenceByDrug);
  const highAlerts = alerts.filter((a) => a.severity === "HIGH");
  if (highAlerts.length > 0) {
    // The renewal is created but flagged: the prescriber must review the fresh
    // alerts and can discontinue it if they no longer apply.
    await prisma.prescription.update({
      where: { id: renewed.id },
      data: { safetyReviewNotes: { renewedFrom: prescription.id, freshAlerts: highAlerts } as object },
    });
  }
  await prisma.prescription.update({
    where: { id: renewed.id },
    data: { safetyReviewedAt: now },
  });

  await writeAudit({
    userId: user.id, patientId: prescription.patientId, actorRole: user.role,
    action: "PRESCRIPTION_RENEWED", resourceType: "Prescription", resourceId: renewed.id,
    details: { renewedFrom: prescription.id, reason: body.reason ?? null }, req,
  });

  // Recreate medication reminders for the renewed items (idempotent per item).
  let reminderFailures = 0;
  for (const item of renewed.items) {
    try {
      await ensureReminderForPrescriptionItem(item.id, user.id);
    } catch (error) {
      reminderFailures += 1;
      console.warn(`[prescriptions] reminder setup failed for renewed item ${item.id}:`, error instanceof Error ? error.message : error);
    }
  }

  return NextResponse.json({ prescription: renewed, alerts, reminderFailures }, { status: 201 });
});
