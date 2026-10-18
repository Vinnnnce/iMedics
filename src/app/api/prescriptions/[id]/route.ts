import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile, findAccessiblePatient } from "@/lib/access";
import { writeAudit } from "@/lib/audit";

const actionSchema = z.object({
  action: z.enum(["CANCEL", "RENEW"]),
  reason: z.string().trim().max(500).optional(),
  validUntil: z.coerce.date().optional(),
});

/** Only the issuing doctor (or an admin) may cancel or renew a prescription. */
export const PATCH = withAuth(["DOCTOR", "ADMIN"], async (req: NextRequest, { params, user }) => {
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
    await writeAudit({
      userId: user.id, patientId: prescription.patientId, actorRole: user.role,
      action: "PRESCRIPTION_CANCELLED", resourceType: "Prescription", resourceId: id,
      details: { reason: body.reason ?? null }, req,
    });
    return NextResponse.json({ prescription: updated });
  }

  // Renew: issue a fresh ACTIVE prescription carrying the same items.
  const renewed = await prisma.prescription.create({
    data: {
      patientId: prescription.patientId,
      doctorId: prescription.doctorId,
      consultationId: prescription.consultationId,
      caseId: prescription.caseId,
      notes: `Renewed from prescription ${prescription.id}${body.reason ? `: ${body.reason}` : ""}`,
      validUntil: body.validUntil,
      safetyReviewedAt: prescription.safetyReviewedAt,
      safetyReviewNotes: prescription.safetyReviewNotes as object | undefined,
      items: {
        create: prescription.items.map((item, index) => ({
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
          dose: item.dose,
          frequency: item.frequency,
          frequencyText: item.frequencyText,
          schedule: item.schedule,
          duration: item.duration,
          startDate: item.startDate,
          endDate: item.endDate,
          quantity: item.quantity,
          refills: item.refills,
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
    userId: user.id, patientId: prescription.patientId, actorRole: user.role,
    action: "PRESCRIPTION_RENEWED", resourceType: "Prescription", resourceId: renewed.id,
    details: { renewedFrom: prescription.id, reason: body.reason ?? null }, req,
  });

  return NextResponse.json({ prescription: renewed }, { status: 201 });
});
