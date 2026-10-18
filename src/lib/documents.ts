import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findAccessiblePatient } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import type { AccessibleDocument } from "@/lib/documents/shared";

/**
 * Patient medical documents: secure upload, storage keys, sharing and access
 * control. Files live in private object storage and are only ever served via
 * short-lived presigned URLs issued after a permission check — never public.
 * Client-safe constants and schemas live in `./shared`.
 */

export {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  createDocumentSchema,
  updateDocumentSchema,
  looksLikeDeclaredType,
} from "@/lib/documents/shared";
export type { DocumentCategory, AccessibleDocument } from "@/lib/documents/shared";

/** Storage key for a patient document (private prefix, never guessable). */
export function documentStorageKey(patientId: string, fileName: string): string {
  const safeExt = fileName.includes(".") ? fileName.split(".").pop()!.slice(0, 8).replace(/[^a-z0-9]/gi, "") : "bin";
  return `patient-documents/${patientId}/${randomUUID()}.${safeExt}`;
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

  if (user.role === "ADMIN") {
    // Per platform policy, admins have no access to patient records — including
    // documents. Out of scope is indistinguishable from non-existent (404).
    throw Object.assign(new Error("Document not found"), { status: 404 });
  }
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
    details: JSON.parse(JSON.stringify(details ?? {})) as object,
  });
}
