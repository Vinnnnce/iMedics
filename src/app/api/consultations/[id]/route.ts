import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { consultationInclude, serializeConsultation } from "@/lib/consultation";
import { findViewableConsultation } from "@/lib/consultation-access";
import { snapshotConsultation } from "@/lib/consultation-report";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { buildDiagnosis } from "@/lib/icd10/service";
import { queueNotification } from "@/lib/notifications/service";

// GET /api/consultations/[id]
//  - doctors: reports they wrote, or reports for patients currently in their care
//  - patients: their own finalized reports
export const GET = withAuth<{ id: string }>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const consultation = await findViewableConsultation(user, id);

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "CONSULTATION_VIEWED",
    resourceType: "Consultation",
    resourceId: id,
    req,
  });

  return NextResponse.json({ consultation: serializeConsultation(consultation) });
});

const text = z.string().trim().max(5000).optional();

const updateSchema = z
  .object({
    chiefComplaint: text,
    historyPresentIllness: text,
    pastMedicalHistory: text,
    symptoms: z
      .array(
        z.object({
          name: z.string().trim().max(200),
          duration: z.string().trim().max(100).optional(),
          severity: z.string().trim().max(50).optional(),
        }),
      )
      .max(50)
      .optional(),
    vitals: z.record(z.string(), z.string().trim().max(50)).optional(),
    examination: text,
    icdCode: z.string().trim().min(1).max(10).optional(),
    differentialDiagnosis: text,
    labFindings: text,
    imagingFindings: text,
    treatmentPlan: text,
    recommendations: text,
    followUpDate: z
      .string()
      .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Invalid follow-up date")
      .optional(),
    notes: text,
    /** Drafts only: replaces the medications on the draft's prescription. */
    medications: z
      .array(
        z.object({
          name: z.string().trim().max(200),
          dose: z.string().trim().max(100).optional(),
          frequency: z.string().trim().max(100).optional(),
          duration: z.string().trim().max(100).optional(),
          instructions: z.string().trim().max(1000).optional(),
        }),
      )
      .max(50)
      .optional(),
    /** A draft can be finalized; a finalized report can never go back to draft. */
    status: z.enum(["draft", "finalized"]).optional(),
    /** Required when amending a finalized report. */
    amendmentReason: z.string().trim().min(5, "Give a short reason (at least 5 characters)").max(500).optional(),
  })
  .strict();

// PATCH /api/consultations/[id] — the writing doctor reviews and edits a report.
//  - DRAFT: edited freely, and can be finalized.
//  - FINALIZED: an amendment. A reason is required, the previous version is kept
//    as a numbered revision, the report's revision number increases and the
//    patient is told. Prescriptions are not touched by an amendment.
export const PATCH = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const doctor = await getVerifiedDoctorProfile(user);
  const data = await parseBody(req, updateSchema);

  const current = await prisma.consultation.findFirst({
    where: { id, doctorId: doctor.id },
    include: consultationInclude,
  });
  if (!current) throw notFound("Consultation not found");

  const wasFinalized = current.status === "FINALIZED";
  if (wasFinalized) {
    if (data.status === "draft") throw badRequest("A finalized report cannot be returned to draft");
    if (!data.amendmentReason) throw badRequest("Give a reason for amending a finalized report");
    if (data.medications !== undefined) {
      throw badRequest("Medications on a finalized report are managed from the Prescriptions page");
    }
  }
  const finalizing = !wasFinalized && data.status === "finalized";

  let diagnosis: Awaited<ReturnType<typeof buildDiagnosis>> = null;
  try {
    diagnosis = await buildDiagnosis(data.icdCode);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "Invalid diagnosis");
  }
  if (finalizing && !diagnosis && !current.icd) throw badRequest("Select an ICD-10 diagnosis");

  // Only keys the caller sent are changed; an empty string clears a text field.
  const textFields = [
    "chiefComplaint", "historyPresentIllness", "pastMedicalHistory", "examination",
    "differentialDiagnosis", "labFindings", "imagingFindings", "treatmentPlan", "recommendations", "notes",
  ] as const;
  const update: Prisma.ConsultationUpdateInput = {};
  for (const key of textFields) {
    if (data[key] !== undefined) update[key] = data[key] || null;
  }
  if (data.symptoms !== undefined) update.symptoms = data.symptoms.filter((s) => s.name);
  if (data.vitals !== undefined) update.vitals = data.vitals;
  if (data.followUpDate !== undefined) update.followUpDate = data.followUpDate ? new Date(data.followUpDate) : null;
  if (diagnosis) {
    update.diagnosis = diagnosis.description;
    update.icd = { upsert: { create: diagnosis, update: diagnosis } };
  }
  if (finalizing) {
    update.status = "FINALIZED";
    update.finalizedAt = new Date();
  }
  if (wasFinalized) {
    update.revision = { increment: 1 };
    update.amendedAt = new Date();
  }

  const medications = data.medications?.filter((m) => m.name);

  let saved;
  try {
    saved = await prisma.$transaction(async (tx) => {
      if (wasFinalized) {
        await tx.consultationRevision.create({
          data: {
            consultationId: id,
            revision: current.revision,
            snapshot: snapshotConsultation(current) as unknown as Prisma.InputJsonValue,
            reason: data.amendmentReason,
            editedById: user.id,
          },
        });
      }

      if (medications !== undefined) {
        await tx.prescription.deleteMany({ where: { consultationId: id } });
        if (medications.length) {
          await tx.prescription.create({
            data: {
              consultationId: id,
              patientId: current.patientId,
              doctorId: doctor.id,
              items: {
                create: medications.map((m) => ({
                  drugName: m.name,
                  dose: m.dose || null,
                  frequency: m.frequency || null,
                  duration: m.duration || null,
                  instructions: m.instructions || null,
                })),
              },
            },
          });
        }
      }

      // The revision number doubles as an optimistic lock: if another request
      // amended the report meanwhile, nothing matches and we report a conflict.
      return tx.consultation.update({
        where: { id, revision: current.revision },
        data: update,
        include: consultationInclude,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2002")) {
      throw conflict("This report was changed in the meantime. Reload it and try again.");
    }
    throw error;
  }

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: wasFinalized ? "CONSULTATION_AMENDED" : "CONSULTATION_UPDATED",
    resourceType: "Consultation",
    resourceId: id,
    details: {
      revision: saved.revision,
      finalized: finalizing,
      fields: Object.keys(data).filter((k) => k !== "amendmentReason"),
      ...(wasFinalized ? { reason: data.amendmentReason } : {}),
    },
    req,
  });

  // Tell the patient when a report they can read has changed.
  if (wasFinalized) {
    const patient = await prisma.patient.findUnique({ where: { id: current.patientId }, select: { userId: true } });
    await queueNotification(patient?.userId, { kind: "CONSULTATION_AMENDED", consultationId: id }).catch(() => undefined);
  }

  return NextResponse.json({ success: true, consultation: serializeConsultation(saved) });
});
