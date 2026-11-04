import type { NextRequest } from "next/server";
import type { FacilityStaffRole, LabStaffProfile, User } from "@prisma/client";
import { prisma } from "./prisma";
import { badRequest, forbidden, notFound } from "./errors";
import { permissionsForRole, FACILITY_PERMISSIONS, type FacilityPermission } from "./facility-staff";
import { assertClinicalPrivilege, filterClinicalPrivileges, REGULATED_PERMISSIONS } from "./organization/privileges";
import { assertRequestPatientScope } from "./organization/patient-scope";
import { assertPlatformPolicy, enforceRequestPolicy } from "./platform/access";

/**
 * Role defaults plus the facility's per-staff permission overrides
 * ({ add: [...], remove: [...] }). Overrides are applied only when the
 * membership's access level is CUSTOM; otherwise role defaults stand.
 * Overriding can only grant permissions the facility admin selected from
 * the known permission catalogue — never invent new ones.
 */
export function effectivePermissions(membership: {
  facilityRole: FacilityStaffRole;
  accessLevel: string;
  permissionOverrides: unknown;
}): readonly FacilityPermission[] {
  if (membership.accessLevel === "NONE") return [];
  const base = permissionsForRole(membership.facilityRole);
  if (membership.accessLevel === "READ_ONLY") return base.filter((p) => p.startsWith("VIEW_"));
  if (membership.accessLevel !== "CUSTOM") return base;
  const raw = membership.permissionOverrides;
  let add: string[] = [];
  let remove: string[] = [];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as { add?: unknown; remove?: unknown };
    if (Array.isArray(o.add)) add = o.add.filter((x): x is string => typeof x === "string");
    if (Array.isArray(o.remove)) remove = o.remove.filter((x): x is string => typeof x === "string");
  }
  const set = new Set(base);
  for (const p of add) if ((FACILITY_PERMISSIONS as readonly string[]).includes(p)) set.add(p as FacilityPermission);
  for (const p of remove) set.delete(p as FacilityPermission);
  return Array.from(set);
}

export interface FacilityAccess {
  user: User;
  facility: LabStaffProfile;
  /** The caller's membership row id for this facility. Owner memberships are backfilled rows. */
  staffId: string;
  facilityRole: FacilityStaffRole;
  permissions: readonly FacilityPermission[];
}

interface MembershipRow {
  accessStartsAt?: Date | null;
  accessExpiresAt?: Date | null;
  departmentIds?: string[];
  id: string;
  facilityRole: FacilityStaffRole;
  status: string;
  userId: string | null;
  accessLevel: string;
  permissionOverrides: unknown;
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
    select: { id: true, facilityRole: true, status: true, userId: true, accessLevel: true, permissionOverrides: true, accessStartsAt: true, accessExpiresAt: true, departmentIds: true, facility: true },
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
  if ((membership.accessStartsAt && membership.accessStartsAt > new Date()) || (membership.accessExpiresAt && membership.accessExpiresAt <= new Date())) throw forbidden("This facility membership is outside its access period");
  const { facility } = membership;
  if (options.requireVerified !== false && facility.verificationStatus !== "VERIFIED") {
    throw forbidden("This facility is not verified yet");
  }
  const effective = effectivePermissions(membership);
  if (membership.accessLevel === "NONE") throw forbidden("Facility access has been revoked");
  if (permission && !effective.includes(permission)) {
    throw forbidden("Your role does not allow this action");
  }
  if (permission) await assertClinicalPrivilege(membership.id, permission);
  if (req) {
    await assertRequestPatientScope({ staffId: membership.id, facilityId: facility.id, accessLevel: membership.accessLevel ?? "STANDARD", departmentIds: membership.departmentIds ?? [] }, req);
    await enforceRequestPolicy(user, req, facility.id);
    const { moduleForPath } = await import("./platform/policy");
    const featureModule = moduleForPath(new URL(req.url).pathname);
    if (featureModule) await assertPlatformPolicy(user, "FEATURE", featureModule, req.method === "GET" ? "VIEW" : "EDIT", facility.id);
  }

  return {
    user,
    facility,
    staffId: membership.id,
    facilityRole: membership.facilityRole,
    permissions: await filterClinicalPrivileges(membership.id, effective),
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
    throw forbidden("You are not an active staff member of that facility");
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

/**
 * Effective facility permissions for a portal page.
 *
 * Facility owners (the account creator) are linked to their facility through a
 * LabStaffProfile rather than a FacilityStaff membership — treat them as OWNER.
 * Invited staff get the union of their active memberships' role permissions.
 * Used by the /lab pages that check permissions directly instead of going
 * through resolveFacilityAccess (which expects a backfilled owner membership).
 */
export async function resolveFacilityPermissions(
  user: User,
  facilityId: string,
): Promise<{ role: FacilityStaffRole; permissions: readonly FacilityPermission[] }> {
  const own = await prisma.labStaffProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  const memberships = await prisma.facilityStaff.findMany({
    where: { userId: user.id, facilityId, status: "ACTIVE", AND: [
      { OR: [{ accessStartsAt: null }, { accessStartsAt: { lte: new Date() } }] },
      { OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: new Date() } }] },
    ] },
    select: { id: true, facilityRole: true, accessLevel: true, permissionOverrides: true },
  });
  const permissions = new Set<FacilityPermission>();
  if (!memberships.length && own?.id === facilityId && !await prisma.facilityStaff.findFirst({ where: { userId: user.id, facilityId }, select: { id: true } })) {
    return { role: "OWNER", permissions: permissionsForRole("OWNER").filter((p) => !REGULATED_PERMISSIONS.includes(p)) };
  }
  for (const membership of memberships) {
    for (const permission of await filterClinicalPrivileges(membership.id, effectivePermissions(membership))) permissions.add(permission);
  }
  return { role: memberships[0]?.facilityRole ?? "FACILITY_MANAGER", permissions: [...permissions] };
}
