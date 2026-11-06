/**
 * Server-side access enforcement for the Super Admin Control Centre.
 *
 * Two independent paths grant console access — never clinical access:
 *  1. An explicit, unexpired SuperAdminGrant (full permissions; writes require
 *     fresh multi-factor authentication, mirroring the master-control gate).
 *  2. An active, unexpired AdminMembership whose roles (plus approved
 *     overrides) carry the required "SECTION:VERB" permission keys.
 *
 * Membership suspension, access expiry and role revocation are enforced on
 * every request. Hiding navigation is never the security mechanism.
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";
import { freshMfa } from "@/lib/platform/access";
import {
  ADMIN_SECTIONS, resolvePermissions, visibleSections,
  type AdminSection, type AdminVerb,
} from "./permissions";

export interface AdminAccess {
  superAdmin: boolean;
  permissions: Set<string>;
  sections: AdminSection[];
  membershipIds: string[];
  grantExpiresAt: Date | null;
}

function membershipWindow(now: Date) {
  return { status: "ACTIVE" as const, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
}
function assignmentWindow(now: Date) {
  return { revokedAt: null as null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

/** Resolve the caller's console access. Returns null when there is none. */
export const getAdminAccess = cache(async function getAdminAccess(user: User): Promise<AdminAccess | null> {
  if (user.status !== "ACTIVE" || user.deletedAt) return null;
  const now = new Date();

  const [grant, memberships, assignments, overrides] = await Promise.all([
    prisma.superAdminGrant.findUnique({ where: { userId: user.id } }),
    prisma.adminMembership.findMany({
      where: { userId: user.id, ...membershipWindow(now) },
      select: { id: true },
    }),
    prisma.adminRoleAssignment.findMany({
      where: {
        userId: user.id, ...assignmentWindow(now),
        role: { active: true },
      },
      select: { role: { select: { permissions: { select: { permissionKey: true } } } } },
    }),
    prisma.adminPermissionOverride.findMany({
      where: { userId: user.id, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { permissionKey: true, effect: true, expiresAt: true },
    }),
  ]);

  const grantActive = Boolean(grant && !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > now));
  if (!grantActive && !memberships.length) return null;

  const permissions = resolvePermissions({
    superAdmin: grantActive,
    grants: assignments.map((a) => ({
      roleKeys: [],
      permissionKeys: a.role.permissions.map((p) => p.permissionKey),
    })),
    overrides: overrides.map((o) => ({
      permissionKey: o.permissionKey,
      effect: o.effect === "DENY" ? "DENY" : "GRANT",
      expiresAt: o.expiresAt,
    })),
    now,
  });

  return {
    superAdmin: grantActive,
    permissions,
    sections: visibleSections(permissions),
    membershipIds: memberships.map((m) => m.id),
    grantExpiresAt: grantActive ? grant!.expiresAt : null,
  };
});

/** Page guard: redirects to /admin when the caller has no console access. */
export async function requireConsolePage(user: User) {
  const access = await getAdminAccess(user);
  if (!access) redirect("/admin");
  return access;
}

/** Page guard for one section: needs at least VIEW, else back to the console home. */
export async function requireSectionPage(user: User, section: AdminSection) {
  const access = await requireConsolePage(user);
  if (!access.sections.includes(section)) redirect("/super-admin");
  return access;
}

/**
 * API guard. Throws forbidden() when the caller lacks the permission.
 * Super-admin-grant actors must re-authenticate with MFA before writing,
 * exactly like the existing master-control gate.
 */
export async function requireAdminPermission(user: User, section: AdminSection, verb: AdminVerb) {
  const access = await getAdminAccess(user);
  if (!access) throw forbidden("Super Admin console authorization required");
  if (!access.permissions.has(`${section}:${verb}`)) {
    throw forbidden(`Your role does not include ${section}:${verb}. Request access from a Super Administrator.`);
  }
  if (access.superAdmin && verb !== "VIEW" && section !== "OVERVIEW") {
    const session = await auth();
    if (!freshMfa(session.sessionClaims?.fva)) {
      throw forbidden("Fresh multi-factor authentication required. Reauthenticate with MFA before making administrative changes.");
    }
  }
  return access;
}

/** All sections the caller may see — used to filter navigation. */
export function navSections(access: AdminAccess): AdminSection[] {
  return ADMIN_SECTIONS.filter((s) => access.sections.includes(s));
}
