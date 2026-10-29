import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findAccessiblePatient } from "@/lib/access";
import { permissionsForRole } from "@/lib/facility-staff";
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

const notFoundDocument = () => Object.assign(new Error("Document not found"), { status: 404 });

/**
 * The facilities whose patient documents this user may read: the facility they
 * own, plus every facility where their staff role grants VIEW_PATIENT_DOCUMENTS.
 */
export async function facilitiesWithDocumentAccess(user: User): Promise<string[]> {
  if (user.status !== "ACTIVE") return [];
  const [own, memberships] = await Promise.all([
    prisma.labStaffProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    prisma.facilityStaff.findMany({
      where: { userId: user.id, status: { in: ["ACTIVE", "ON_LEAVE"] } },
      select: { facilityId: true, facilityRole: true },
      take: 20,
    }),
  ]);
  const ids = new Set<string>();
  if (own) ids.add(own.id);
  for (const m of memberships) {
    if (permissionsForRole(m.facilityRole).includes("VIEW_PATIENT_DOCUMENTS")) ids.add(m.facilityId);
  }
  return [...ids];
}

/**
 * Resolve a document for the caller or throw 404. Patients can see their own
 * documents; clinicians can see documents of patients assigned to them or that
 * they uploaded; facility staff can read documents their facility issued and
 * documents a patient shared with their facility (read-only); individual share
 * recipients see documents shared with them (read-only). Admins never have access.
 */
export async function findAccessibleDocument(user: User, documentId: string): Promise<AccessibleDocument> {
  const document = await prisma.patientDocument.findUnique({
    where: { id: documentId },
    include: { patient: { include: { user: true } } },
  });
  if (!document || document.deletedAt) throw notFoundDocument();

  // Per platform policy, admins have no access to patient records — including
  // documents. Out of scope is indistinguishable from non-existent (404).
  if (user.role === "ADMIN") throw notFoundDocument();

  if (user.role === "PATIENT" && document.patient.userId === user.id) {
    return { document, canManage: true };
  }

  let canManage = document.uploadedById === user.id;
  if (user.role === "DOCTOR") {
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (doctor) {
      const assignment = await prisma.patientAssignment.findFirst({
        where: { patientId: document.patientId, doctorId: doctor.id },
        select: { id: true },
      });
      if (assignment) canManage = true;
    }
  }
  if (canManage) return { document, canManage: true };

  // Facility staff (including staff whose platform role is PATIENT): issued by
  // their facility, or shared by the patient with their facility. Read-only.
  const facilityIds = await facilitiesWithDocumentAccess(user);
  if (facilityIds.length > 0) {
    if (document.issuingFacilityId && facilityIds.includes(document.issuingFacilityId)) {
      return { document, canManage: false };
    }
    const facilityShare = await prisma.documentFacilityShare.findFirst({
      where: { documentId, facilityId: { in: facilityIds }, revokedAt: null },
      select: { id: true },
    });
    if (facilityShare) return { document, canManage: false };
  }

  // An individual share to this user (read-only).
  const share = await prisma.documentShare.findFirst({
    where: { documentId, sharedWithUserId: user.id, revokedAt: null },
    select: { id: true },
  });
  if (share) return { document, canManage: false };

  throw notFoundDocument();
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
