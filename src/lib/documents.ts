import { randomUUID, createHash } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findAccessiblePatient } from "@/lib/access";
import { effectivePermissions } from "@/lib/facility-auth";
import {
  getStaffMembership,
  assertStaffCanReachPatient,
} from "@/lib/staff-access";
import { writeAudit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import type { AccessibleDocument } from "@/lib/documents/shared";

/**
 * Patient medical documents: secure upload, storage keys, sharing, and access
 * control.
 *
 * Files live in private object storage and are served only through short-lived
 * presigned URLs issued after a permission check. They are never public.
 * Client-safe constants and schemas remain in `./shared`.
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

export type {
  DocumentCategory,
  AccessibleDocument,
} from "@/lib/documents/shared";

const MAX_STORAGE_KEY_LENGTH = 500;
const MAX_MEMBERSHIPS = 50;

/** Must be an ApiError so it is not reported as an unexpected 500. */
const notFoundDocument = () => notFound("Document not found");

export type DocumentAccessReason =
  | "PATIENT_OWNER"
  | "UPLOADER"
  | "ASSIGNED_CLINICIAN"
  | "FACILITY_ISSUER"
  | "FACILITY_SHARE"
  | "INDIVIDUAL_SHARE";

export interface DocumentAccessResult extends AccessibleDocument {
  reason: DocumentAccessReason;
}

/** Sanitise a filename extension for use in a private object-storage key. */
function safeExtension(fileName: string): string {
  const extension = fileName.includes(".")
    ? fileName.split(".").pop() ?? ""
    : "";

  const cleaned = extension
    .toLowerCase()
    .slice(0, 8)
    .replace(/[^a-z0-9]/g, "");

  return cleaned || "bin";
}

/**
 * Storage key for a patient document.
 *
 * The patient ID is included for operational tracing, but the UUID prevents
 * predictable keys. The filename itself is never embedded in the key.
 */
export function documentStorageKey(
  patientId: string,
  fileName: string,
): string {
  if (!patientId?.trim()) {
    throw new Error("A patient ID is required to create a document key");
  }

  const key = `patient-documents/${patientId}/${randomUUID()}.${safeExtension(
    fileName,
  )}`;

  if (key.length > MAX_STORAGE_KEY_LENGTH) {
    throw new Error("Generated document storage key is too long");
  }

  return key;
}

/** Stable integrity hash for uploaded document bytes or checksums. */
export function documentContentHash(content: Uint8Array | string): string {
  return createHash("sha256")
    .update(content)
    .digest("hex");
}

const isActiveMembership = (
  membership: {
    accessStartsAt: Date | null;
    accessExpiresAt: Date | null;
  },
  now: Date,
): boolean =>
  (membership.accessStartsAt === null ||
    membership.accessStartsAt <= now) &&
  (membership.accessExpiresAt === null ||
    membership.accessExpiresAt > now);

/**
 * Facilities whose patient documents this user may read:
 * - the laboratory/facility they own;
 * - every active facility membership granting `VIEW_PATIENT_DOCUMENTS`.
 */
export async function facilitiesWithDocumentAccess(
  user: User,
): Promise<string[]> {
  if (user.status !== "ACTIVE") return [];

  const now = new Date();

  const [ownFacility, memberships] = await Promise.all([
    prisma.labStaffProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    }),
    prisma.facilityStaff.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        OR: [
          { accessStartsAt: null },
          { accessStartsAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { accessExpiresAt: null },
              { accessExpiresAt: { gt: now } },
            ],
          },
        ],
      },
      select: {
        facilityId: true,
        facilityRole: true,
        accessLevel: true,
        permissionOverrides: true,
        accessStartsAt: true,
        accessExpiresAt: true,
      },
      take: MAX_MEMBERSHIPS,
    }),
  ]);

  const facilityIds = new Set<string>();

  if (ownFacility) {
    facilityIds.add(ownFacility.id);
  }

  for (const membership of memberships) {
    if (!isActiveMembership(membership, now)) continue;

    const permissions = effectivePermissions({
      facilityRole: membership.facilityRole,
      accessLevel: membership.accessLevel,
      permissionOverrides: membership.permissionOverrides,
    });

    if (permissions.includes("VIEW_PATIENT_DOCUMENTS")) {
      facilityIds.add(membership.facilityId);
    }
  }

  return [...facilityIds];
}

/**
 * Resolve a document for the caller or throw 404.
 *
 * Access precedence:
 * 1. Patient owner: full management access.
 * 2. Original uploader: management access.
 * 3. Assigned doctor: management access.
 * 4. Facility staff: issuing facility or active facility share, read-only.
 * 5. Individual share recipient: read-only.
 *
 * Platform administrators have no access to patient records, including
 * documents. Out-of-scope access is indistinguishable from non-existence.
 */
export async function findAccessibleDocument(
  user: User,
  documentId: string,
): Promise<DocumentAccessResult> {
  if (!documentId?.trim()) {
    throw notFoundDocument();
  }

  const document = await prisma.patientDocument.findUnique({
    where: { id: documentId },
    include: {
      patient: {
        include: { user: true },
      },
    },
  });

  if (!document || document.deletedAt) {
    throw notFoundDocument();
  }

  if (user.role === "ADMIN") {
    throw notFoundDocument();
  }

  if (
    user.role === "PATIENT" &&
    document.patient.userId === user.id
  ) {
    return {
      document,
      canManage: true,
      reason: "PATIENT_OWNER",
    };
  }

  if (document.uploadedById === user.id) {
    return {
      document,
      canManage: true,
      reason: "UPLOADER",
    };
  }

  if (user.role === "DOCTOR") {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (doctor) {
      const assignment = await prisma.patientAssignment.findFirst({
        where: {
          patientId: document.patientId,
          doctorId: doctor.id,
        },
        select: { id: true },
      });

      if (assignment) {
        return {
          document,
          canManage: true,
          reason: "ASSIGNED_CLINICIAN",
        };
      }
    }
  }

  const facilityIds = await facilitiesWithDocumentAccess(user);

  if (facilityIds.length > 0) {
    if (
      document.issuingFacilityId &&
      facilityIds.includes(document.issuingFacilityId)
    ) {
      const membership = await getStaffMembership(
        user,
        document.issuingFacilityId,
      );

      await assertStaffCanReachPatient(
        membership,
        document.patientId,
      );

      return {
        document,
        canManage: false,
        reason: "FACILITY_ISSUER",
      };
    }

    const facilityShare =
      await prisma.documentFacilityShare.findFirst({
        where: {
          documentId,
          facilityId: { in: facilityIds },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
          revokedAt: null,
        },
        select: {
          id: true,
          facilityId: true,
        },
      });

    if (facilityShare) {
      const membership = await getStaffMembership(
        user,
        facilityShare.facilityId,
      );

      await assertStaffCanReachPatient(
        membership,
        document.patientId,
      );

      return {
        document,
        canManage: false,
        reason: "FACILITY_SHARE",
      };
    }
  }

  const individualShare = await prisma.documentShare.findFirst({
    where: {
      documentId,
      sharedWithUserId: user.id,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
      revokedAt: null,
    },
    select: { id: true },
  });

  if (individualShare) {
    return {
      document,
      canManage: false,
      reason: "INDIVIDUAL_SHARE",
    };
  }

  throw notFoundDocument();
}

/**
 * Resolve the patient a document belongs to for a clinician caller.
 *
 * This performs the same write-capable patient access check used elsewhere,
 * ensuring a clinician cannot attach documents to an unassigned patient.
 */
export async function assertClinicianCanAttach(
  user: User,
  patientId: string,
): Promise<void> {
  if (!patientId?.trim()) {
    throw notFound("Patient not found");
  }

  await findAccessiblePatient(user, patientId, {
    write: true,
  });
}

/** Audit helper for document access and changes. */
export async function auditDocumentAccess(
  user: User,
  documentId: string,
  patientId: string,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await writeAudit({
    userId: user.id,
    patientId,
    actorRole: user.role,
    action,
    resourceType: "PatientDocument",
    resourceId: documentId,
    details: JSON.parse(JSON.stringify(details ?? {})),
  });
}
