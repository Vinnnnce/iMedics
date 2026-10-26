import type { NextRequest } from "next/server";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound, forbidden } from "@/lib/errors";
import { requireFacilityAccess, type FacilityAccess } from "@/lib/facility-auth";
import { resolveFacilityKind, type FacilityKindValue } from "@/lib/modules/access-matrix";
import type { FacilityPermission } from "@/lib/facility-staff";

export interface HisAccess extends FacilityAccess {
  kind: FacilityKindValue;
}

/** Facility membership + permission + organization kind, resolved per request. */
export async function requireHisAccess(
  user: User,
  permission: FacilityPermission | null,
  req: NextRequest | Request,
  kinds: FacilityKindValue[] = ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"],
): Promise<HisAccess> {
  const access = await requireFacilityAccess(user, permission, req);
  const kind = await resolveFacilityKind(access.facility.id);
  if (!kind || !kinds.includes(kind)) throw forbidden("Your organization is not authorized to use this module");
  return { ...access, kind };
}

export function hasPermission(access: Pick<FacilityAccess, "permissions">, permission: FacilityPermission): boolean {
  return access.permissions.includes(permission);
}

/**
 * Tenant guard for patient-level work: the patient must already have a care
 * relationship with this facility (encounter, admission, booking, lab order,
 * coverage or document). New relationships start with an encounter registered
 * after exact identity verification. Returns 404 otherwise so ids cannot be
 * probed across hospitals.
 */
export async function assertPatientLinked(facilityId: string, patientId: string): Promise<void> {
  const [encounter, admission, booking, order, coverage, doc] = await Promise.all([
    prisma.encounter.findFirst({ where: { facilityId, patientId }, select: { id: true } }),
    prisma.admission.findFirst({ where: { facilityId, patientId }, select: { id: true } }),
    prisma.facilityBooking.findFirst({ where: { patientId, service: { facilityId } }, select: { id: true } }),
    prisma.labOrder.findFirst({ where: { patientId, OR: [{ performingFacilityId: facilityId }, { requestingFacilityId: facilityId }] }, select: { id: true } }),
    prisma.payerCoverage.findFirst({ where: { facilityId, patientId }, select: { id: true } }),
    prisma.clinicalDocument.findFirst({ where: { facilityId, patientId }, select: { id: true } }),
  ]);
  if (!encounter && !admission && !booking && !order && !coverage && !doc) throw notFound("Patient not found");
}

/** Exact identity verification: case number AND date of birth must match. */
export async function findPatientByIdentity(caseNumber: string, dateOfBirth: string) {
  const patient = await prisma.patient.findFirst({
    where: { caseNumber: caseNumber.trim().toUpperCase(), deletedAt: null },
    select: { id: true, caseNumber: true, firstName: true, lastName: true, gender: true, dateOfBirth: true },
  });
  if (!patient) return null;
  const dob = patient.dateOfBirth.toISOString().slice(0, 10);
  return dob === dateOfBirth.slice(0, 10) ? patient : null;
}

/** Mask restricted identifiers (policy/member numbers) for users without MANAGE_INSURANCE. */
export function maskIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";
  return `${"•".repeat(Math.min(8, value.length - 4))}${value.slice(-4)}`;
}
