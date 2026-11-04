/**
 * Tests for effectivePermissions (src/lib/facility-auth.ts): role defaults,
 * CUSTOM override merging, catalogue validation and non-CUSTOM passthrough.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({ prisma: {} }));

import { effectivePermissions } from "./facility-auth";
import { permissionsForRole, FACILITY_PERMISSIONS } from "./facility-staff";

describe("effectivePermissions", () => {
  it("returns role defaults when the access level is not CUSTOM", () => {
    const base = permissionsForRole("NURSE");
    expect(effectivePermissions({ facilityRole: "NURSE", accessLevel: "STANDARD", permissionOverrides: { add: ["MANAGE_STAFF"] } })).toEqual(base);
    expect(effectivePermissions({ facilityRole: "NURSE", accessLevel: "FULL", permissionOverrides: null })).toEqual(base);
  });

  it("applies add overrides only for CUSTOM access", () => {
    const result = effectivePermissions({
      facilityRole: "NURSE",
      accessLevel: "CUSTOM",
      permissionOverrides: { add: ["MANAGE_STAFF"] },
    });
    expect(result).toContain("MANAGE_STAFF");
    for (const p of permissionsForRole("NURSE")) expect(result).toContain(p);
  });

  it("removes permissions listed in the remove set", () => {
    const role = "FACILITY_MANAGER" as const;
    const removed = permissionsForRole(role)[0];
    const result = effectivePermissions({
      facilityRole: role,
      accessLevel: "CUSTOM",
      permissionOverrides: { remove: [removed] },
    });
    expect(result).not.toContain(removed);
    expect(result).toHaveLength(permissionsForRole(role).length - 1);
  });

  it("ignores overrides that are not in the permission catalogue", () => {
    const result = effectivePermissions({
      facilityRole: "NURSE",
      accessLevel: "CUSTOM",
      permissionOverrides: { add: ["NOT_A_REAL_PERMISSION", "MANAGE_STAFF"], remove: ["ALSO_FAKE"] },
    });
    expect(result).toContain("MANAGE_STAFF");
    expect(result).not.toContain("NOT_A_REAL_PERMISSION");
    expect(result.every((p) => (FACILITY_PERMISSIONS as readonly string[]).includes(p))).toBe(true);
  });

  it("tolerates malformed override objects", () => {
    const base = permissionsForRole("NURSE");
    expect(effectivePermissions({ facilityRole: "NURSE", accessLevel: "CUSTOM", permissionOverrides: "garbage" })).toEqual(base);
    expect(effectivePermissions({ facilityRole: "NURSE", accessLevel: "CUSTOM", permissionOverrides: { add: "nope" } })).toEqual(base);
    expect(effectivePermissions({ facilityRole: "NURSE", accessLevel: "CUSTOM", permissionOverrides: { add: [42, null] } })).toEqual(base);
  });

  it("never invents permissions outside the catalogue even for CUSTOM", () => {
    const result = effectivePermissions({
      facilityRole: "LAB_SCIENTIST",
      accessLevel: "CUSTOM",
      permissionOverrides: { add: ["SUPERUSER", "*"] },
    });
    expect(result.every((p) => (FACILITY_PERMISSIONS as readonly string[]).includes(p))).toBe(true);
  });
});
