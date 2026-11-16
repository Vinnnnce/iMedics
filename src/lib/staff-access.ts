import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import type { User } from "@prisma/client";

/**
 * Patient-level access control for facility staff.
 *
 * Design rules:
 * - A staff account alone never grants access to every patient.
 * - LIMITED staff reach only explicitly assigned patients or patients covered
 *   by an active break-glass grant.
 * - STANDARD and FULL staff reach patients with a care relationship at the
 *   facility.
 * - EXTENDED staff additionally reach patients currently in one of their
 *   assigned departments.
 * - Full facility access means all permitted operations at this facility; it
 *   never grants access to another facility's patients.
 * - Break-glass access is temporary, justification-based, and audited.
 */

export const BREAK_GLASS_DEFAULT_MINUTES = 240;
export const BREAK_GLASS_MAX_MINUTES = 480;
export const BREAK_GLASS_MIN_JUSTIFICATION_LENGTH = 20;

const MS_PER_MINUTE = 60_000;

export type StaffAccessLevel =
  | "NONE"
  | "LIMITED"
  | "STANDARD"
  | "EXTENDED"
  | "FULL"
  | "CUSTOM"
  | "READ_ONLY"
  | "DEPARTMENT";

export interface StaffMembershipInfo {
  staffId: string;
  facilityId: string;
  accessLevel: StaffAccessLevel;
  departmentIds: string[];
}

export type PatientAccessReason =
  | "PATIENT_GRANT"
  | "BREAK_GLASS"
  | "DEPARTMENT_ASSIGNMENT"
  | "FACILITY_CARE_RELATIONSHIP";

export interface PatientAccessDecision {
  allowed: boolean;
  reason?: PatientAccessReason;
}

const isStaffAccessLevel = (
  value: string,
): value is StaffAccessLevel =>
  ["NONE", "LIMITED", "STANDARD", "EXTENDED", "FULL", "CUSTOM", "READ_ONLY", "DEPARTMENT"].includes(value);

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

/** Load the caller's active membership for a facility. */
export async function getStaffMembership(
  user: User,
  facilityId: string,
): Promise<StaffMembershipInfo> {
  if (!user?.id || !facilityId?.trim()) {
    throw forbidden(
      "You are not an active staff member of that facility",
    );
  }

  const now = new Date();

  const membership = await prisma.facilityStaff.findFirst({
    where: {
      userId: user.id,
      facilityId,
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
      id: true,
      accessLevel: true,
      departmentIds: true,
      accessStartsAt: true,
      accessExpiresAt: true,
    },
  });

  if (!membership || !isActiveMembership(membership, now)) {
    throw forbidden(
      "You are not an active staff member of that facility",
    );
  }

  const accessLevel = isStaffAccessLevel(membership.accessLevel)
    ? membership.accessLevel
    : "NONE";

  return {
    staffId: membership.id,
    facilityId,
    accessLevel,
    departmentIds: membership.departmentIds ?? [],
  };
}

/**
 * Does this staff member have a live break-glass grant for the patient?
 * Grants are active, unexpired, and not closed.
 */
export async function hasActiveBreakGlass(
  facilityId: string,
  staffId: string,
  patientId: string,
): Promise<boolean> {
  if (!facilityId || !staffId || !patientId) return false;

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

/**
 * Does the patient have any care relationship with this facility?
 *
 * Results are intentionally not cached indefinitely: clinical relationships
 * change frequently, so callers should use this check per request or apply a
 * very short cache only when their workload requires it.
 */
export async function patientLinkedToFacility(
  facilityId: string,
  patientId: string,
): Promise<boolean> {
  if (!facilityId || !patientId) return false;

  const now = new Date();

  const [
    encounter,
    admission,
    booking,
    order,
    coverage,
    document,
  ] = await Promise.all([
    prisma.encounter.findFirst({
      where: { facilityId, patientId },
      select: { id: true },
    }),
    prisma.admission.findFirst({
      where: { facilityId, patientId },
      select: { id: true },
    }),
    prisma.facilityBooking.findFirst({
      where: {
        patientId,
        service: { facilityId },
      },
      select: { id: true },
    }),
    prisma.labOrder.findFirst({
      where: {
        patientId,
        OR: [
          { performingFacilityId: facilityId },
          { requestingFacilityId: facilityId },
        ],
      },
      select: { id: true },
    }),
    prisma.payerCoverage.findFirst({
      where: { facilityId, patientId },
      select: { id: true },
    }),
    prisma.clinicalDocument.findFirst({
      where: {
        facilityId,
        patientId,
        deletedAt: null,
      },
      select: { id: true },
    }),
  ]);

  return Boolean(
    encounter ||
      admission ||
      booking ||
      order ||
      coverage ||
      document,
  );
}

/** Is the patient explicitly assigned to this staff member through a live grant? */
export async function hasPatientGrant(
  facilityId: string,
  staffId: string,
  patientId: string,
): Promise<boolean> {
  if (!facilityId || !staffId || !patientId) return false;

  const now = new Date();

  const grant = await prisma.staffPatientAccess.findFirst({
    where: {
      facilityId,
      staffId,
      patientId,
      revokedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
    select: { id: true },
  });

  return Boolean(grant);
}

/** Is the patient currently admitted in one of the staff member's departments? */
async function patientInStaffDepartments(
  facilityId: string,
  departmentIds: string[],
  patientId: string,
): Promise<boolean> {
  const uniqueDepartmentIds = [...new Set(departmentIds)];

  if (uniqueDepartmentIds.length === 0) return false;

  const departments = await prisma.facilityDepartment.findMany({
    where: {
      id: { in: uniqueDepartmentIds },
      facilityId,
    },
    select: { id: true },
  });

  if (departments.length === 0) return false;

  const validDepartmentIds = departments.map(
    (department) => department.id,
  );

  const wards = await prisma.ward.findMany({
    where: {
      facilityId,
      departmentId: { in: validDepartmentIds },
    },
    select: { id: true },
  });

  if (wards.length === 0) return false;

  const admission = await prisma.admission.findFirst({
    where: {
      facilityId,
      patientId,
      status: "ACTIVE",
      currentWardId: {
        in: wards.map((ward) => ward.id),
      },
    },
    select: { id: true },
  });

  return Boolean(admission);
}

/**
 * Server-side patient reach check for a staff member.
 *
 * Call this before returning any patient-scoped clinical data to a facility
 * user. It throws a 404-shaped error when access is denied, preventing
 * patient-ID probing across facilities.
 */
export async function assertStaffCanReachPatient(
  membership: StaffMembershipInfo,
  patientId: string,
): Promise<PatientAccessDecision> {
  if (!membership?.facilityId || !membership.staffId || !patientId) {
    throw notFound("Patient not found");
  }

  const { facilityId, staffId, accessLevel } = membership;

  if (accessLevel === "NONE") {
    throw notFound("Patient not found");
  }

  if (
    await hasPatientGrant(facilityId, staffId, patientId)
  ) {
    return { allowed: true, reason: "PATIENT_GRANT" };
  }

  if (
    await hasActiveBreakGlass(facilityId, staffId, patientId)
  ) {
    return { allowed: true, reason: "BREAK_GLASS" };
  }

  if (accessLevel === "LIMITED") {
    throw notFound("Patient not found");
  }

  if (
    accessLevel === "DEPARTMENT" ||
    accessLevel === "EXTENDED"
  ) {
    const inDepartment = await patientInStaffDepartments(
      facilityId,
      membership.departmentIds,
      patientId,
    );

    if (inDepartment) {
      return {
        allowed: true,
        reason: "DEPARTMENT_ASSIGNMENT",
      };
    }

    if (accessLevel === "DEPARTMENT") {
      throw notFound("Patient not found");
    }
  }

  if (
    accessLevel === "STANDARD" ||
    accessLevel === "EXTENDED" ||
    accessLevel === "FULL"
  ) {
    const linked = await patientLinkedToFacility(
      facilityId,
      patientId,
    );

    if (linked) {
      return {
        allowed: true,
        reason: "FACILITY_CARE_RELATIONSHIP",
      };
    }
  }

  throw notFound("Patient not found");
}

export interface BreakGlassGrant {
  id: string;
  expiresAt: Date;
}

/**
 * Create a break-glass emergency-access grant.
 *
 * Justification is mandatory, the duration is bounded, and the grant is
 * audited. If an active grant already exists, it is reused rather than
 * extended silently.
 */
export async function createBreakGlassAccess(
  membership: StaffMembershipInfo,
  patientId: string,
  justification: string,
  minutes: number = BREAK_GLASS_DEFAULT_MINUTES,
): Promise<BreakGlassGrant> {
  const trimmedJustification = justification?.trim() ?? "";

  if (
    trimmedJustification.length <
    BREAK_GLASS_MIN_JUSTIFICATION_LENGTH
  ) {
    throw badRequest(
      `A break-glass justification of at least ${BREAK_GLASS_MIN_JUSTIFICATION_LENGTH} characters is mandatory`,
    );
  }

  if (
    !Number.isInteger(minutes) ||
    minutes <= 0 ||
    minutes > BREAK_GLASS_MAX_MINUTES
  ) {
    throw badRequest(
      `Break-glass duration must be between 1 and ${BREAK_GLASS_MAX_MINUTES} minutes`,
    );
  }

  if (!patientId?.trim()) {
    throw notFound("Patient not found");
  }

  const [linked, existingGrant] = await Promise.all([
    patientLinkedToFacility(
      membership.facilityId,
      patientId,
    ),
    prisma.breakGlassAccess.findFirst({
      where: {
        facilityId: membership.facilityId,
        staffId: membership.staffId,
        patientId,
        closedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        expiresAt: true,
      },
    }),
  ]);

  if (!linked) {
    const hasGrant = await hasPatientGrant(
      membership.facilityId,
      membership.staffId,
      patientId,
    );

    if (!hasGrant) {
      throw notFound("Patient not found");
    }
  }

  if (existingGrant) {
    return existingGrant;
  }

  const expiresAt = new Date(
    Date.now() + minutes * MS_PER_MINUTE,
  );

  const grant = await prisma.breakGlassAccess.create({
    data: {
      facilityId: membership.facilityId,
      staffId: membership.staffId,
      patientId,
      justification: trimmedJustification,
      expiresAt,
    },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      facilityId: membership.facilityId,
      patientId,
      userId: membership.staffId,
      action: "BREAK_GLASS_ACCESS_GRANTED",
      resourceType: "PATIENT",
      resourceId: patientId,
      details: {
        breakGlassGrantId: grant.id,
        justification: trimmedJustification,
        durationMinutes: minutes,
        expiresAt: expiresAt.toISOString(),
      },
      outcome: "SUCCESS",
    },
  });

  return grant;
}

/**
 * Close (revoke early) a break-glass grant.
 *
 * The update is conditional on the grant still being open, preventing a race
 * where two reviewers close the same grant simultaneously.
 */
export async function closeBreakGlassAccess(
  membership: StaffMembershipInfo,
  grantId: string,
  reason: string,
): Promise<void> {
  if (!grantId?.trim()) {
    throw notFound("Break-glass grant not found");
  }

  const closedReason =
    reason?.trim().slice(0, 500) || "Closed early";
  const now = new Date();

  const updated = await prisma.breakGlassAccess.updateMany({
    where: {
      id: grantId,
      facilityId: membership.facilityId,
      staffId: membership.staffId,
      closedAt: null,
    },
    data: {
      closedAt: now,
      closedReason,
    },
  });

  if (updated.count !== 1) {
    throw notFound("Break-glass grant not found");
  }

  await prisma.auditLog.create({
    data: {
      facilityId: membership.facilityId,
      userId: membership.staffId,
      action: "BREAK_GLASS_ACCESS_CLOSED",
      resourceType: "BREAK_GLASS_GRANT",
      resourceId: grantId,
      details: {
        reason: closedReason,
        closedAt: now.toISOString(),
      },
      outcome: "SUCCESS",
    },
  });
}
