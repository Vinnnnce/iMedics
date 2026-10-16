import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { findAccessiblePatient, getVerifiedDoctorProfile } from "@/lib/access";
import { consultationInclude, serializeConsultation } from "@/lib/consultation";
import { badRequest } from "@/lib/errors";
import { buildDiagnosisRows } from "@/lib/icd10/service";
import { queueNotification } from "@/lib/notifications/service";
import { createCareCaseInTx, derivedStatusForConsultation } from "@/lib/cases";

const listQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/consultations — doctors see the reports they wrote; patients see their own finalized reports.
export const GET = withAuth(["DOCTOR", "PATIENT"], async (req, { user }) => {
  const { patientId, limit } = parseQuery(req, listQuerySchema);

  let where: Prisma.ConsultationWhereInput;
  if (user.role === "DOCTOR") {
    const doctor = await getVerifiedDoctorProfile(user);
    where = { doctorId: doctor.id, ...(patientId ? { patientId } : {}) };
  } else {
    where = { status: "FINALIZED", patient: { userId: user.id, deletedAt: null } };
  }

  await prisma.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "CONSULTATIONS_READ", resourceType: "Consultation", ...(patientId ? { resourceId: patientId } : {}) } });
  const consultations = await prisma.consultation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: consultationInclude,
  });

  return NextResponse.json({ consultations: consultations.map(serializeConsultation) });
});

const text = z.string().trim().max(5000).optional();

const createSchema = z.object({
  patientId: z.string().uuid(),
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
    .default([]),
  vitals: z.record(z.string(), z.string().trim().max(50)).default({}),
  examination: text,
  /** The single ICD-10 code picked from the searchable list. */
  diagnoses: z
    .array(z.object({ code: z.string().trim().min(1).max(10), isPrimary: z.boolean().optional() }))
    .max(1)
    .default([]),
  differentialDiagnosis: text,
  labFindings: text,
  imagingFindings: text,
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
    .default([]),
  treatmentPlan: text,
  recommendations: text,
  followUpDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid follow-up date")
    .optional(),
  notes: text,
  status: z.enum(["draft", "finalized"]).default("finalized"),
  assistance: z.object({ method: z.enum(["local-extractive", "ai-assisted"]), reviewed: z.literal(true) }).optional(),
});

// POST /api/consultations — a doctor saves a consultation report for a patient in their care.
// The author is always the signed-in doctor; any prescribed medications become a Prescription.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const data = await parseBody(req, createSchema);
  const patient = await findAccessiblePatient(user, data.patientId, { write: true });

  const symptoms = data.symptoms.filter((s) => s.name);
  const medications = data.medications.filter((m) => m.name);
  const finalized = data.status === "finalized";
  if (finalized && data.diagnoses.length === 0) throw badRequest("Select an ICD-10 diagnosis");
  if (!finalized && medications.length) throw badRequest("Medications can only be issued from a finalized consultation");

  let diagnosisRows;
  try {
    diagnosisRows = await buildDiagnosisRows(data.diagnoses);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "Invalid diagnosis");
  }

  const consultation = await prisma.$transaction(async tx => {
    // Every consultation opens a unified care-episode case. The case number is
    // allocated server-side inside this transaction; the consultation and any
    // prescriptions link to it so related records share one episode.
    const careCase = await createCareCaseInTx(tx, {
      type: "CONSULTATION",
      patientId: data.patientId,
      primaryDoctorId: doctor.id,
      specialty: doctor.specialty || null,
      presentingComplaint: data.chiefComplaint || null,
      diagnosisSummary: diagnosisRows.summary || null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      status: derivedStatusForConsultation(
        finalized ? "FINALIZED" : "DRAFT",
        finalized ? new Date() : null,
        data.followUpDate ? new Date(data.followUpDate) : null,
      ),
      actorId: user.id,
      note: "Consultation recorded",
    });

    const saved = await tx.consultation.create({
    data: {
      patientId: data.patientId,
      doctorId: doctor.id,
      caseId: careCase.id,
      chiefComplaint: data.chiefComplaint || null,
      historyPresentIllness: data.historyPresentIllness || null,
      pastMedicalHistory: data.pastMedicalHistory || null,
      symptoms,
      vitals: data.vitals,
      examination: data.examination || null,
      // Denormalised summary of the primary diagnosis for lists and the AI pipeline.
      diagnosis: diagnosisRows.summary,
      diagnoses: { create: diagnosisRows.rows },
      differentialDiagnosis: data.differentialDiagnosis || null,
      labFindings: data.labFindings || null,
      imagingFindings: data.imagingFindings || null,
      treatmentPlan: data.treatmentPlan || null,
      recommendations: data.recommendations || null,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
      notes: data.notes || null,
      status: finalized ? "FINALIZED" : "DRAFT",
      finalizedAt: finalized ? new Date() : null,
      ...(medications.length
        ? {
            prescriptions: {
              create: {
                patientId: data.patientId,
                doctorId: doctor.id,
                caseId: careCase.id,
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
            },
          }
        : {}),
    },
    include: consultationInclude,
  });

  await tx.auditLog.create({ data: {
    userId: user.id,
    actorRole: user.role,
    action: "CONSULTATION_CREATED",
    resourceType: "Consultation",
    resourceId: saved.id,
    details: { status: saved.status, prescribed: medications.length, diagnoses: diagnosisRows.rows.length, caseNumber: careCase.caseNumber, ...(data.assistance ? { assistanceMethod: data.assistance.method, assistanceReviewed: true } : {}) },
  } });
    return saved;
  });

  if (finalized) await queueNotification(patient.userId, { kind: "CONSULTATION_AVAILABLE" });
  return NextResponse.json({ success: true, consultation: serializeConsultation(consultation) }, { status: 201 });
});
