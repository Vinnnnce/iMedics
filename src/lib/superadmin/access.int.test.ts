import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";

/**
 * Super Admin console access boundaries, verified against a real PostgreSQL
 * database (spec §22 acceptance tests): suspended or expired memberships lose
 * access, roles grant only their catalog permissions, DENY overrides win, and
 * a Super Admin grant carries the full catalog with a fresh-MFA write gate.
 *
 * Enabled with SA_TEST_DATABASE_URL pointing at a disposable *_test database.
 */

const identity = vi.hoisted(() => {
  const url = process.env.SA_TEST_DATABASE_URL;
  if (url) {
    if (!new URL(url).pathname.endsWith("_test")) throw new Error("Super Admin access tests require a disposable *_test database");
    process.env.DATABASE_URL = url;
  }
  return { actor: null as User | null, fva: [0, 0] as [number, number] };
});
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ sessionClaims: { fva: identity.fva } }),
}));
vi.mock("@/lib/errors", () => {
  class ApiError extends Error {
    constructor(public readonly status: number, message: string) { super(message); }
  }
  return {
    ApiError,
    badRequest: (m = "Invalid request") => new ApiError(400, m),
    unauthorized: (m = "Authentication required") => new ApiError(401, m),
    forbidden: (m = "Forbidden") => new ApiError(403, m),
    notFound: (m = "Not found") => new ApiError(404, m),
    conflict: (m = "Conflict") => new ApiError(409, m),
  };
});
import { prisma } from "@/lib/prisma";
import { getAdminAccess, requireAdminPermission } from "./access";
import { permissionKey } from "./permissions";

const enabled = Boolean(process.env.SA_TEST_DATABASE_URL);

describe.skipIf(!enabled)("Super Admin console: server-enforced access boundaries", () => {
  let supportUserId: string;
  let membershipId: string;
  let grantId: string | null = null;

  beforeAll(async () => {
    const email = `sa-access-${randomUUID()}@medic1905.test`;
    const user = await prisma.user.create({ data: { clerkId: `sa-access-${randomUUID()}`, email, name: "Access Test Admin", role: "ADMIN", status: "ACTIVE", onboardingComplete: true } });
    supportUserId = user.id;
    const dept = await prisma.adminDepartment.create({ data: { name: `Access Test Dept ${randomUUID().slice(0, 8)}` } });
    membershipId = (await prisma.adminMembership.create({ data: { userId: user.id, departmentId: dept.id, title: "Technical Support Officer", createdById: user.id } })).id;
  });

  afterAll(async () => {
    if (grantId) await prisma.superAdminGrant.delete({ where: { userId: supportUserId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: supportUserId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    identity.actor = await prisma.user.findUniqueOrThrow({ where: { id: supportUserId } });
    identity.fva = [0, 0];
    await prisma.adminRoleAssignment.deleteMany({ where: { userId: supportUserId } });
    await prisma.adminPermissionOverride.deleteMany({ where: { userId: supportUserId } });
    await prisma.adminMembership.update({ where: { id: membershipId }, data: { status: "ACTIVE", endsAt: null } });
  });

  it("a membership without roles grants console access but no sections", async () => {
    const access = await getAdminAccess(identity.actor!);
    expect(access).not.toBeNull();
    expect(access!.superAdmin).toBe(false);
    expect(access!.sections).toHaveLength(0);
  });

  it("the Technical Support Officer role grants its catalog scope only — no patient records", async () => {
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { key: "TECH_SUPPORT_OFFICER" } });
    await prisma.adminRoleAssignment.create({ data: { userId: supportUserId, roleId: role.id, reason: "Acceptance test assignment", assignedById: supportUserId } });
    const access = await getAdminAccess(identity.actor!);
    expect(access!.sections).toContain("OVERVIEW");
    expect(access!.sections).toContain("USERS");
    expect(access!.sections).toContain("SYSTEM_HEALTH");
    expect(access!.sections).not.toContain("PATIENT_ACCOUNTS");
    expect(access!.sections).not.toContain("DOCUMENTS");
    await expect(requireAdminPermission(identity.actor!, "USERS", "VIEW")).resolves.toBeTruthy();
    await expect(requireAdminPermission(identity.actor!, "PATIENT_ACCOUNTS", "VIEW")).rejects.toThrow(/does not include/);
    await expect(requireAdminPermission(identity.actor!, "SETTINGS", "CONFIGURE")).rejects.toThrow(/does not include/);
  });

  it("revoking the role removes the permissions immediately", async () => {
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { key: "TECH_SUPPORT_OFFICER" } });
    const assignment = await prisma.adminRoleAssignment.create({ data: { userId: supportUserId, roleId: role.id, reason: "Acceptance test assignment", assignedById: supportUserId } });
    expect((await getAdminAccess(identity.actor!))!.sections).toContain("USERS");
    await prisma.adminRoleAssignment.update({ where: { id: assignment.id }, data: { revokedAt: new Date() } });
    expect((await getAdminAccess(identity.actor!))!.sections).not.toContain("USERS");
  });

  it("a suspended membership loses console access entirely", async () => {
    await prisma.adminMembership.update({ where: { id: membershipId }, data: { status: "SUSPENDED" } });
    expect(await getAdminAccess(identity.actor!)).toBeNull();
  });

  it("an expired access window loses console access entirely", async () => {
    await prisma.adminMembership.update({ where: { id: membershipId }, data: { startsAt: new Date(Date.now() - 7200_000), endsAt: new Date(Date.now() - 3600_000) } });
    expect(await getAdminAccess(identity.actor!)).toBeNull();
    await prisma.adminMembership.update({ where: { id: membershipId }, data: { startsAt: new Date(Date.now() - 7200_000), endsAt: new Date(Date.now() + 3600_000) } });
  });

  it("a time-boxed role assignment expires on schedule", async () => {
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { key: "TECH_SUPPORT_OFFICER" } });
    await prisma.adminRoleAssignment.create({ data: { userId: supportUserId, roleId: role.id, reason: "Acceptance test assignment", assignedById: supportUserId, expiresAt: new Date(Date.now() - 1000) } });
    const access = await getAdminAccess(identity.actor!);
    expect(access!.sections).not.toContain("USERS");
  });

  it("a DENY override beats the role permission", async () => {
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { key: "TECH_SUPPORT_OFFICER" } });
    await prisma.adminRoleAssignment.create({ data: { userId: supportUserId, roleId: role.id, reason: "Acceptance test assignment", assignedById: supportUserId } });
    await prisma.adminPermissionOverride.create({ data: { userId: supportUserId, permissionKey: permissionKey("USERS", "VIEW"), effect: "DENY", reason: "Acceptance test override", createdById: supportUserId } });
    const access = await getAdminAccess(identity.actor!);
    expect(access!.sections).not.toContain("USERS");
  });

  it("an inactive user loses console access", async () => {
    await prisma.user.update({ where: { id: supportUserId }, data: { status: "SUSPENDED" } });
    const suspended = await prisma.user.findUniqueOrThrow({ where: { id: supportUserId } });
    expect(await getAdminAccess(suspended)).toBeNull();
    await prisma.user.update({ where: { id: supportUserId }, data: { status: "ACTIVE" } });
    identity.actor = await prisma.user.findUniqueOrThrow({ where: { id: supportUserId } });
  });

  it("a Super Admin grant carries the full permission catalog", async () => {
    await prisma.superAdminGrant.deleteMany({ where: { userId: supportUserId } });
    await prisma.superAdminGrant.create({ data: { userId: supportUserId, grantedBy: "acceptance-test", reason: "Acceptance test grant" } });
    const access = await getAdminAccess(identity.actor!);
    expect(access!.superAdmin).toBe(true);
    expect(access!.sections).toHaveLength(26);
    await expect(requireAdminPermission(identity.actor!, "SETTINGS", "CONFIGURE")).resolves.toBeTruthy();
  });

  it("super-admin writes require fresh multi-factor authentication", async () => {
    identity.fva = [16, 5]; // stale: outside the accepted freshness window
    await expect(requireAdminPermission(identity.actor!, "SETTINGS", "CONFIGURE")).rejects.toThrow(/multi-factor/i);
    identity.fva = [0, 0];
    await expect(requireAdminPermission(identity.actor!, "SETTINGS", "CONFIGURE")).resolves.toBeTruthy();
  });
});
