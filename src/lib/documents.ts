import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findAccessiblePatient } from "@/lib/access";
import { writeAudit } from "@/lib/audit";

/**
 * Patient medical documents: secure upload, storage keys, sharing and access
 * control. Files live in private object storage and are only ever served via
 * short-lived presigned URLs issued after a permission check — never public.
 */

export const DOCUMENT_CATEGORIES = [
  "LAB_REPORT",
  "DIAGNOSTIC_REPORT",
  "IMAGING_REPORT",
  "PRESCRIPTION",
  "DISCHARGE_SUMMARY",
  "REFERRAL_LETTER",
  "VACCINATION_RECORD",
  "OTHER",
] as const;

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  LAB_REPORT: "Laboratory report",
  DIAGNOSTIC_REPORT: "Diagnostic report",
  IMAGING_REPORT: "Imaging report",
  PRESCRIPTION: "Prescription",
  DISCHARGE_SUMMARY: "Discharge summary",
  REFERRAL_LETTER: "Referral letter",
  VACCINATION_RECORD: "Vaccination record",
  OTHER: "Other",
};

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Common medical document formats: PDF and standard images. */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(DOCUMENT_CATEGORIES),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  patientId: z.string().uuid().optional(),
  issuedOn: z.coerce.date().optional(),
  issuingFacility: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  notes: z.string().trim().max(1000).optional(),
  issuedOn: z.coerce.date().optional(),
});

/** Storage key for a patient document (private prefix, never guessable). */
export function documentStorageKey(patientId: string, fileName: string): string {
  const safeExt = fileName.includes(".") ? fileName.split(".").pop()!.slice(0, 8).replace(/[^a-z0-9]/gi, "") : "bin";
  return `patient-documents/${patientId}/${randomUUID()}.${safeExt}`;
}

/** Whether a sniffed file head looks like the declared type (basic magic bytes). */
export function looksLikeDeclaredType(head: Uint8Array, mimeType: string): boolean {
  const starts = (bytes: number[]) => bytes.length <= head.length && bytes.every((b, i) => head[i] === b);
  switch (mimeType) {
    case "application/pdf":
      return starts([0x25, 0x50, 0x44, 0x46]); // %PDF
    case "image/jpeg":
      return starts([0xff, 0xd8, 0xff]);
    case "image/png":
      return starts([0x89, 0x50, 0x4e, 0x47]);
    case "image/webp":
      return head.length >= 12 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50; // WEBP
    default:
      return false;
  }
}

export interface AccessibleDocument {
  document: {
    id: string;
    patientId: string;
    category: string;
    title: string;
    fileName: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    issuingFacility: string | null;
    issuedOn: Date | null;
    notes: string | null;
    uploadedById: string;
    createdAt: Date;
    deletedAt: Date | null;
  };
  canManage: boolean;
}

/**
 * Resolve a document for the caller or throw 404. Patients can see their own
 * documents and documents clinicians attached for them; clinicians can see
 * documents of patients assigned to them; shared recipients see documents shared
 * with them (read-only).
 */
export async function findAccessibleDocument(user: User, documentId: string): Promise<AccessibleDocument> {
  const document = await prisma.patientDocument.findUnique({
    where: { id: documentId },
    include: { patient: { include: { user: true } } },
  });
  if (!document || document.deletedAt) throw Object.assign(new Error("Document not found"), { status: 404 });

  if (user.role === "PATIENT") {
    if (document.patient.userId !== user.id) throw Object.assign(new Error("Document not found"), { status: 404 });
    return { document, canManage: true };
  }

  if (user.role === "DOCTOR" || user.role === "LAB_SCIENTIST") {
    // Clinicians: assigned patients (doctors) or their own uploads.
    const share = await prisma.documentShare.findFirst({
      where: { documentId, sharedWithUserId: user.id, revokedAt: null },
    });
    let assigned = false;
    if (user.role === "DOCTOR") {
      const doctor = await prisma.doctorProfile.findUnique({ where: { userId: user.id } });
      if (doctor) {
        const assignment = await prisma.patientAssignment.findFirst({
          where: { patientId: document.patientId, doctorId: doctor.id },
          select: { id: true },
        });
        assigned = Boolean(assignment);
      }
    }
    if (document.uploadedById === user.id || assigned) {
      return { document, canManage: assigned || document.uploadedById === user.id };
    }
    if (share) return { document, canManage: false };
    throw Object.assign(new Error("Document not found"), { status: 404 });
  }

  if (user.role === "ADMIN") return { document, canManage: true };
  throw Object.assign(new Error("Document not found"), { status: 404 });
}

/** Resolve the patient a document belongs to for a doctor caller (assignment check). */
export async function assertClinicianCanAttach(user: User, patientId: string) {
  await findAccessiblePatient(user, patientId, { write: true });
}

/** Audit helper for document access and changes. */
export async function auditDocumentAccess(user: User, documentId: string, patientId: string, action: string, details?: Record<string, unknown>) {
  await writeAudit({
    userId: user.id,
    patientId,
    actorRole: user.role,
    action,
    resourceType: "PatientDocument",
    resourceId: documentId,
    details: (details ?? {}) as Record<string, string>,
  });
}
