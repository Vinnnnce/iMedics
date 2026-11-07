import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, notFound } from "@/lib/errors";
import { findPatientByIdentity, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

/**
 * Reconcile a temporary (unidentified) emergency patient with their real
 * record, matched exactly on case number + date of birth. All clinical
 * activity recorded under the temporary record is moved to the real
 * patient; the temporary record is then retired. Nothing is deleted.
 */

const schema = z.object({
  temporaryPatientId: z.string().uuid(),
  caseNumber: z.string().trim().min(6).max(30),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Tables with a plain patient_id FK that can be reassigned in bulk. */
const PATIENT_FK_TABLES = [
  "encounters",
  "admissions",
  "admission_notes",
  "clinical_documents",
  "medical_media",
  "nursing_observations",
  "nursing_tasks",
  "nursing_handovers",
  "medication_orders",
  "medication_administrations",
  "payer_coverages",
  "facility_referrals",
  "patient_documents",
  "critical_result_alerts",
  "diagnostic_reports",
  "diagnostic_images",
  "nursing_assessments",
  "nursing_care_plans",
  "controlled_substance_events",
] as const;

export const POST = withAuth(null, async (req: NextRequest, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const body = await parseBody(req, schema);

  const temporary = await prisma.patient.findFirst({
    where: { id: body.temporaryPatientId, unidentified: true, deletedAt: null },
    select: { id: true, caseNumber: true },
  });
  if (!temporary) throw notFound("Temporary patient record not found");

  const real = await findPatientByIdentity(body.caseNumber, body.dateOfBirth);
  if (!real) throw notFound("No patient matches that case number and date of birth");
  if (real.id === temporary.id) throw badRequest("Cannot reconcile a record with itself");

  await prisma.$transaction(async (tx) => {
    // Remove rows under the temporary record that would collide with
    // per-patient unique constraints on the real record.
    await tx.patientAssignment.deleteMany({
      where: { patientId: temporary.id, doctor: { assignments: { some: { patientId: real.id } } } },
    });
    await tx.doctorLike.deleteMany({
      where: { patientId: temporary.id, doctor: { likes: { some: { patientId: real.id } } } },
    });
    await tx.doctorReview.deleteMany({
      where: { patientId: temporary.id, doctor: { reviews: { some: { patientId: real.id } } } },
    });

    for (const table of PATIENT_FK_TABLES) {
      await tx.$executeRawUnsafe(
        `UPDATE "${table}" SET patient_id = $1 WHERE patient_id = $2`,
        real.id,
        temporary.id,
      );
    }

    // Retire the temporary record (kept for audit, never deleted).
    await tx.patient.update({
      where: { id: temporary.id },
      data: {
        deletedAt: new Date(),
        firstName: `[Reconciled: ${temporary.caseNumber}]`,
        lastName: real.id.slice(0, 8),
        unidentified: false,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        facilityId: access.facility.id,
        patientId: real.id,
        action: "ED_PATIENT_RECONCILED",
        resourceType: "Patient",
        resourceId: real.id,
        details: { temporaryPatientId: temporary.id, temporaryCaseNumber: temporary.caseNumber },
        outcome: "SUCCESS",
      },
    });
  });

  await auditHis(access, "ED_PATIENT_RECONCILED", "Patient", real.id, req, {
    patientId: real.id,
    details: { temporaryPatientId: temporary.id },
  });
  return NextResponse.json({ patientId: real.id, caseNumber: real.caseNumber });
});
