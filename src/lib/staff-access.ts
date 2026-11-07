import { prisma } from "@/lib/prisma";
import { forbidden, notFound, badRequest } from "@/lib/errors";
import type { User } from "@prisma/client";

/**
 * Patient-level access control for facility staff.
 *
 * Design rules (mirroring the platform's access-control contract):
 * - A staff account alone never grants access to every patient.
 * - LIMITED staff reach only patients explicitly assigned to them
 *   (StaffPatientAccess) or patients they have an active break-glass grant for.
 * - STANDARD/EXTENDED/FULL staff reach any patient that has a care
 *   relationship with the facility (the existing tenant guard), with
 *   EXTENDED adding department-scoped patients.
 * - Full facility access means "all permitted operations at THIS facility",
 *   never other facilities' patients.
 * - Break-glass grants are temporary, justification-mandatory and audited.
 */

export const BREAK_GLASS_DEFAULT_MINUTES = 240;

export interface StaffMembershipInfo {
  staffId: string;
  facilityId: string;
  accessLevel: string;
  departmentIds: string[];
}

/** Load the caller's membership info for a facility (verified active). */
export async function getStaffMembership(user: User, facilityId: string): Promise<StaffMembershipInfo> {
  const membership = await prisma.facilityStaff.findFirst({
    where: { userId: user.id, facilityId, status: "ACTIVE", AND: [
      { OR: [{ accessStartsAt: null }, { accessStartsAt: { lte: new Date() } }] },
      { OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: new Date() } }] },
    ] },
    select: { id: true, accessLevel: true, departmentIds: true },
  });
  if (!membership) throw forbidden("You are not an active staff member of that facility");
  return {
    staffId: membership.id,
    facilityId,
    accessLevel: membership.accessLevel,
    departmentIds: membership.departmentIds ?? [],
  };
}

/**
 * Does this staff member have a live break-glass grant for the patient?
 * Grants are single-use windows: active, not expired, not closed.
 */
export async function hasActiveBreakGlass(facilityId: string, staffId: string, patientId: string): Promise<boolean> {
  const grant = await prisma.breakGlassAccess.findFirst({
    where: {
      facilityId,
      staffId,
      patientId,
      closedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return Boolean(grant);
}

/** Does the patient have any care relationship with this facility? */
export async function patientLinkedToFacility(facilityId: string, patientId: string): Promise<boolean> {
  const [encounter, admission, booking, order, coverage, doc] = await Promise.all([
    prisma.encounter.findFirst({ where: { facilityId, patientId }, select: { id: true } }),
    prisma.admission.findFirst({ where: { facilityId, patientId }, select: { id: true } }),
    prisma.facilityBooking.findFirst({ where: { patientId, service: { facilityId } }, select: { id: true } }),
    prisma.labOrder.findFirst({
      where: { patientId, OR: [{ performingFacilityId: facilityId }, { requestingFacilityId: facilityId }] },
      select: { id: true },
    }),
    prisma.payerCoverage.findFirst({ where: { facilityId, patientId }, select: { id: true } }),
    prisma.clinicalDocument.findFirst({ where: { facilityId, patientId }, select: { id: true } }),
  ]);
  return Boolean(encounter || admission || booking || order || coverage || doc);
}

/** Is the patient explicitly assigned to this staff member (live grant)? */
export async function hasPatientGrant(facilityId: string, staffId: string, patientId: string): Promise<boolean> {
  const grant = await prisma.staffPatientAccess.findFirst({
    where: {
      facilityId,
      staffId,
      patientId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  return Boolean(grant);
}

/** Is the patient linked to any of the staff member's departments? */
async function patientInStaffDepartments(facilityId: string, departmentIds: string[], patientId: string): Promise<boolean> {
  if (departmentIds.length === 0) return false;
  const dept = await prisma.facilityDepartment.findFirst({
    where: { id: { in: departmentIds }, facilityId },
    select: { id: true },
  });
  if (!dept) return false;
  const wards = await prisma.ward.findMany({ where: { facilityId, departmentId: { in: departmentIds } }, select: { id: true } });
  if (!wards.length) return false;
  const admission = await prisma.admission.findFirst({
    where: { facilityId, patientId, status: "ACTIVE", currentWardId: { in: wards.map((w) => w.id) } },
    select: { id: true },
  });
  return Boolean(admission);
}

/**
 * Server-side patient reach check for a staff member. Call this before
 * returning any patient-scoped clinical data to a facility user.
 * Returns true when access is allowed, throws a 404-shaped error when not
 * (so patient ids cannot be probed across facilities).
 */
export async function assertStaffCanReachPatient(
  membership: StaffMembershipInfo,
  patientId: string,
): Promise<void> {
  const { facilityId, staffId, accessLevel } = membership;
  if (accessLevel === "NONE") throw notFound("Patient not found");

  // 1. Explicit per-staff grant (care team, department, temporary).
  if (await hasPatientGrant(facilityId, staffId, patientId)) return;

  // 2. Active break-glass grant.
  if (await hasActiveBreakGlass(facilityId, staffId, patientId)) return;

  // 3. LIMITED staff reach nothing else.
  if (accessLevel === "LIMITED") throw notFound("Patient not found");
  if (accessLevel === "DEPARTMENT") {
    if (await patientInStaffDepartments(facilityId, membership.departmentIds, patientId)) return;
    throw notFound("Patient not found");
  }

  // 4. EXTENDED: also patients in the staff member's assigned departments.
  if (accessLevel === "EXTENDED") {
    if (await patientInStaffDepartments(facilityId, membership.departmentIds, patientId)) return;
    // fall through to care-relationship check
  }

  // 5. STANDARD/EXTENDED/FULL: patient must have a care relationship here.
  if (await patientLinkedToFacility(facilityId, patientId)) return;

  throw notFound("Patient not found");
}

/**
 * Create a break-glass (emergency access) grant. Justification is mandatory
 * (minimum 20 characters) and the grant is time-limited and fully audited.
 */
export async function createBreakGlassAccess(
  membership: StaffMembershipInfo,
  patientId: string,
  justification: string,
  minutes: number = BREAK_GLASS_DEFAULT_MINUTES,
): Promise<{ id: string; expiresAt: Date }> {
  const trimmed = justification.trim();
  if (trimmed.length < 20) {
    throw badRequest("A break-glass justification of at least 20 characters is mandatory");
  }
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 480) {
    throw badRequest("Break-glass duration must be between 1 and 480 minutes");
  }
  // The patient must exist and belong to this facility's care universe.
  const linked = await patientLinkedToFacility(membership.facilityId, patientId);
  const grantExists = await hasPatientGrant(membership.facilityId, membership.staffId, patientId);
  if (!linked && !grantExists) throw notFound("Patient not found");

  const existing = await prisma.breakGlassAccess.findFirst({
    where: {
      facilityId: membership.facilityId,
      staffId: membership.staffId,
      patientId,
      closedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, expiresAt: true },
  });
  if (existing) return existing;

  const expiresAt = new Date(Date.now() + minutes * 60_000);
  const grant = await prisma.breakGlassAccess.create({
    data: {
      facilityId: membership.facilityId,
      staffId: membership.staffId,
      patientId,
      justification: trimmed,
      expiresAt,
    },
    select: { id: true, expiresAt: true },
  });
  // Audit entry (facility audit log) — the grant itself is also auditable.
  await prisma.auditLog.create({
    data: {
      facilityId: membership.facilityId,
      patientId,
      action: "BREAK_GLASS_ACCESS_GRANTED",
      resourceType: "PATIENT",
      resourceId: patientId,
      details: { justification: trimmed, expiresAt: expiresAt.toISOString() },
      outcome: "SUCCESS",
    },
  });
  return grant;
}

/** Close (revoke early) a break-glass grant. */
export async function closeBreakGlassAccess(
  membership: StaffMembershipInfo,
  grantId: string,
  reason: string,
): Promise<void> {
  const grant = await prisma.breakGlassAccess.findFirst({
    where: { id: grantId, facilityId: membership.facilityId },
    select: { id: true },
  });
  if (!grant) throw notFound("Break-glass grant not found");
  await prisma.breakGlassAccess.update({
    where: { id: grant.id },
    data: { closedAt: new Date(), closedReason: reason.slice(0, 500) || "Closed early" },
  });
  await prisma.auditLog.create({
    data: {
      facilityId: membership.facilityId,
      action: "BREAK_GLASS_ACCESS_CLOSED",
      resourceType: "BREAK_GLASS_GRANT",
      resourceId: grantId,
      details: { reason: reason.slice(0, 500) },
      outcome: "SUCCESS",
    },
  });
}
