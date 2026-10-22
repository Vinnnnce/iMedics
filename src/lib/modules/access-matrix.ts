/**
 * Module access matrix (Hospital / Laboratory / Diagnostic Centre).
 *
 * Server-side authorization policy for the three integrated modules. This is
 * the single source of truth mirrored by the API routes: every protected
 * action resolves the caller's facility kind and consults this matrix —
 * hiding navigation items is never the security mechanism.
 *
 * Spec (Section 7) summary:
 * - HOSPITAL facilities may use all three modules, limited to their own
 *   patients, orders and permissions.
 * - LABORATORY facilities see only laboratory orders/results where they are
 *   the performing facility, plus the minimum patient data needed.
 * - DIAGNOSTIC_CENTRE facilities see only their diagnostic referrals,
 *   examinations and reports.
 */

import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";
import type { FacilityAccess } from "@/lib/facility-auth";
import type { LabStaffProfile } from "@prisma/client";

export type FacilityKindValue = "LABORATORY" | "DIAGNOSTIC_CENTRE" | "HOSPITAL";
export type ModuleKey = "HOSPITAL" | "LABORATORY" | "DIAGNOSTIC";

/** Which modules each organization type can use at all. */
export const KIND_MODULES: Record<FacilityKindValue, ModuleKey[]> = {
  HOSPITAL: ["HOSPITAL", "LABORATORY", "DIAGNOSTIC"],
  LABORATORY: ["LABORATORY"],
  DIAGNOSTIC_CENTRE: ["DIAGNOSTIC"],
};

/** Resource classes and the access each organization type gets. */
export type ResourceAccess =
  /** Full access within the organization's own patients and permissions. */
  | "FULL"
  /** Access limited to the minimum data required to perform the request. */
  | "MINIMUM"
  /** No access at all. */
  | "NONE";

export const RESOURCE_MATRIX = {
  PATIENT_REGISTRATION: { HOSPITAL: "FULL", LABORATORY: "MINIMUM", DIAGNOSTIC_CENTRE: "MINIMUM" },
  ADMISSION_RECORDS: { HOSPITAL: "FULL", LABORATORY: "NONE", DIAGNOSTIC_CENTRE: "NONE" },
  OUTPATIENT_RECORDS: { HOSPITAL: "FULL", LABORATORY: "NONE", DIAGNOSTIC_CENTRE: "NONE" },
  INPATIENT_RECORDS: { HOSPITAL: "FULL", LABORATORY: "NONE", DIAGNOSTIC_CENTRE: "NONE" },
  LAB_ORDERS: { HOSPITAL: "FULL", LABORATORY: "FULL", DIAGNOSTIC_CENTRE: "NONE" },
  LAB_RESULTS: { HOSPITAL: "FULL", LABORATORY: "FULL", DIAGNOSTIC_CENTRE: "NONE" },
  DIAGNOSTIC_REFERRALS: { HOSPITAL: "FULL", LABORATORY: "NONE", DIAGNOSTIC_CENTRE: "FULL" },
  DIAGNOSTIC_REPORTS: { HOSPITAL: "FULL", LABORATORY: "NONE", DIAGNOSTIC_CENTRE: "FULL" },
  DIAGNOSTIC_IMAGES: { HOSPITAL: "FULL", LABORATORY: "NONE", DIAGNOSTIC_CENTRE: "FULL" },
  DISCHARGE_SUMMARIES: { HOSPITAL: "FULL", LABORATORY: "NONE", DIAGNOSTIC_CENTRE: "NONE" },
  TREATMENT_PLANS: { HOSPITAL: "FULL", LABORATORY: "NONE", DIAGNOSTIC_CENTRE: "NONE" },
  OWN_AUDIT_LOGS: { HOSPITAL: "FULL", LABORATORY: "FULL", DIAGNOSTIC_CENTRE: "FULL" },
} as const satisfies Record<string, Record<FacilityKindValue, ResourceAccess>>;

export type ResourceKey = keyof typeof RESOURCE_MATRIX;

export function canAccess(kind: FacilityKindValue, module: ModuleKey): boolean {
  return KIND_MODULES[kind].includes(module);
}

export function accessTo(kind: FacilityKindValue, resource: ResourceKey): ResourceAccess {
  return RESOURCE_MATRIX[resource][kind];
}

/** Which module a resource belongs to (used to route authorization checks). */
export const RESOURCE_MODULE: Record<ResourceKey, ModuleKey> = {
  PATIENT_REGISTRATION: "HOSPITAL",
  ADMISSION_RECORDS: "HOSPITAL",
  OUTPATIENT_RECORDS: "HOSPITAL",
  INPATIENT_RECORDS: "HOSPITAL",
  LAB_ORDERS: "LABORATORY",
  LAB_RESULTS: "LABORATORY",
  DIAGNOSTIC_REFERRALS: "DIAGNOSTIC",
  DIAGNOSTIC_REPORTS: "DIAGNOSTIC",
  DIAGNOSTIC_IMAGES: "DIAGNOSTIC",
  DISCHARGE_SUMMARIES: "HOSPITAL",
  TREATMENT_PLANS: "HOSPITAL",
  OWN_AUDIT_LOGS: "HOSPITAL", // each organization sees only its own audit trail
};

/**
 * Resolve a facility's organization kind, falling back to the owner's account
 * type for legacy rows that predate the denormalized `kind` column.
 */
export async function resolveFacilityKind(facilityId: string): Promise<FacilityKindValue | null> {
  const facility = await prisma.labStaffProfile.findUnique({
    where: { id: facilityId },
    select: { kind: true, user: { select: { accountType: true } } },
  });
  if (!facility) return null;
  if (facility.kind) return facility.kind;
  const at = facility.user.accountType;
  return at === "HOSPITAL" || at === "LABORATORY" || at === "DIAGNOSTIC_CENTRE" ? at : null;
}

export class ModuleAccessError extends Error {
  status: number;
  constructor(message: string) {
    super(message);
    this.status = 403;
  }
}

/**
 * Guard: the caller's facility must be of the given kind. Throws the API
 * "forbidden" error (403) used across the codebase so route handlers return
 * a consistent response.
 */
export function assertFacilityKind(kind: FacilityKindValue, expected: FacilityKindValue): void {
  if (kind !== expected) {
    throw forbidden(
      `This action is only available to ${expected === "HOSPITAL" ? "hospitals" : expected === "LABORATORY" ? "laboratories" : "diagnostic centres"}`,
    );
  }
}

/**
 * Guard used inside facility routes: resolves the facility kind and enforces
 * that it is one of the allowed kinds (e.g. admissions are hospital-only).
 */
export async function requireFacilityKind(
  access: FacilityAccess,
  allowed: FacilityKindValue[],
): Promise<FacilityKindValue> {
  const kind = await resolveFacilityKind(access.facility.id);
  if (!kind || !allowed.includes(kind)) {
    throw forbidden("Your organization is not authorized to use this module");
  }
  return kind;
}

/** Minimum patient fields a laboratory or diagnostic centre may see. */
export const MINIMUM_PATIENT_SELECT = {
  id: true,
  caseNumber: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  gender: true,
} as const;

export type FacilityLike = Pick<LabStaffProfile, "id"> & { kind?: FacilityKindValue | null };
