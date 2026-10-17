import type { NextRequest } from "next/server";
import type { FacilityStaffRole, LabStaffProfile, User } from "@prisma/client";
import { prisma } from "./prisma";
import { badRequest, forbidden, notFound } from "./errors";
import { permissionsForRole, roleHasPermission, type FacilityPermission } from "./facility-staff";

export interface FacilityAccess {
  user: User;
  facility: LabStaffProfile;
  /** The caller's membership row id for this facility. Owner memberships are backfilled rows. */
  staffId: string;
  facilityRole: FacilityStaffRole;
  permissions: readonly FacilityPermission[];
}

interface MembershipRow {
  id: string;
  facilityRole: FacilityStaffRole;
  status: string;
  userId: string | null;
  facility: LabStaffProfile;
}

/**
 * Resolve the facility a staff member is acting for. Reads happen on every
 * request — a suspended or terminated membership, or a deactivated user, is
 * rejected immediately even if the Clerk session is still alive.
 *
 * Facility selection is explicit: a user with several active memberships must
 * say which facility (query param `facilityId` or the `x-facility-id` header).
 */
export async function requireFacilityAccess(
  user: User,
  permission: FacilityPermission | null,
  req?: NextRequest | Request,
  options: { requireVerified?: boolean } = {},
): Promise<FacilityAccess> {
  if (user.status !== "ACTIVE") throw forbidden("Your account is not active");

  const requested =
    new URL(req?.url ?? "http://local").searchParams.get("facilityId") ??
    (req instanceof Request ? req.headers.get("x-facility-id") : null) ??
    undefined;

  const memberships: MembershipRow[] = await prisma.facilityStaff.findMany({
    where: { userId: user.id, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: { id: true, facilityRole: true, status: true, userId: true, facility: true },
  });

  if (memberships.length === 0) {
    throw forbidden("You are not an active staff member of any facility");
  }

  let membership = memberships[0];
  if (requested) {
    const match =
      memberships.find((m) => m.id === requested) ?? memberships.find((m) => m.facility.id === requested);
    if (!match) throw forbidden("You are not a staff member of that facility");
    membership = match;
  } else if (memberships.length > 1) {
    throw badRequest("Select a facility to continue");
  }

  if (membership.status !== "ACTIVE") {
    throw forbidden("Your staff account is not active for this facility");
  }
  const { facility } = membership;
  if (options.requireVerified !== false && facility.verificationStatus !== "VERIFIED") {
    throw forbidden("This facility is not verified yet");
  }
  if (permission && !roleHasPermission(membership.facilityRole, permission)) {
    throw forbidden("Your role does not allow this action");
  }

  return {
    user,
    facility,
    staffId: membership.id,
    facilityRole: membership.facilityRole,
    permissions: permissionsForRole(membership.facilityRole),
  };
}

/** Facility ids the user has an active membership for (portal switcher). */
export async function activeFacilityIdsForUser(userId: string): Promise<string[]> {
  const rows = await prisma.facilityStaff.findMany({
    where: { userId, status: "ACTIVE" },
    select: { facilityId: true },
  });
  return rows.map((r) => r.facilityId);
}

/** Does this user have any active facility membership (portal access)? */
export async function hasFacilityMembership(userId: string): Promise<boolean> {
  return (await activeFacilityIdsForUser(userId)).length > 0;
}

/**
 * Resolve the facility the user is acting for in the portal. Legacy owners
 * (role LAB_SCIENTIST with their own profile) keep working; invited staff get
 * their (first) active membership's facility. Callers with several
 * memberships should pass an explicit facilityId.
 */
export async function resolveFacilityForPortalUser(user: User, facilityId?: string | null): Promise<LabStaffProfile> {
  if (facilityId) {
    const membership = await prisma.facilityStaff.findFirst({
      where: { userId: user.id, facilityId, status: "ACTIVE" },
      select: { facility: true },
    });
    if (membership) return membership.facility;
  }
  const own = await prisma.labStaffProfile.findUnique({ where: { userId: user.id } });
  if (own) return own;
  const membership = await prisma.facilityStaff.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: { facility: true },
  });
  if (!membership) throw notFound("No facility found for this account");
  return membership.facility;
}

/**
 * The facility a staff booking/action belongs to, for tenant checks:
 * booking → service → facility.
 */
export async function facilityIdForBooking(bookingId: string): Promise<string | null> {
  const row = await prisma.facilityBooking.findUnique({
    where: { id: bookingId },
    select: { service: { select: { facilityId: true } } },
  });
  return row?.service.facilityId ?? null;
}

/** Throws 404 when a record does not belong to the facility (cross-tenant denial). */
export function assertSameFacility(
  recordFacilityId: string | null | undefined,
  facilityId: string,
  what = "Record",
): void {
  if (!recordFacilityId || recordFacilityId !== facilityId) throw notFound(`${what} not found`);
}
