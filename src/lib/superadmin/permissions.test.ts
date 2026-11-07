import { describe, expect, it } from "vitest";
import {
  ADMIN_SECTIONS, DEFAULT_APPROVAL_WORKFLOWS, DEFAULT_DEPARTMENTS, DEFAULT_ROLES,
  SECTION_VERBS, allPermissionKeys, can, isValidPermissionKey, permissionKey,
  resolvePermissions, visibleSections,
} from "./permissions";

const now = new Date("2026-11-07T00:00:00Z");
const future = new Date("2027-01-01T00:00:00Z");
const past = new Date("2026-01-01T00:00:00Z");

describe("permission catalog", () => {
  it("covers the recommended sidebar sections", () => {
    expect(ADMIN_SECTIONS).toHaveLength(26);
    for (const section of ADMIN_SECTIONS) expect(SECTION_VERBS[section]).toContain("VIEW");
  });

  it("every default role permission key is a valid catalog key", () => {
    for (const role of DEFAULT_ROLES) {
      expect(role.permissions.length, role.key).toBeGreaterThan(0);
      for (const key of role.permissions) expect(isValidPermissionKey(key), `${role.key}: ${key}`).toBe(true);
    }
  });

  it("the Super Admin role carries every permission; support-style roles carry none beyond their scope", () => {
    const all = new Set(allPermissionKeys());
    const superRole = DEFAULT_ROLES.find((r) => r.key === "SUPER_ADMIN")!;
    expect(superRole.permissions.every((p) => all.has(p))).toBe(true);
    const support = DEFAULT_ROLES.find((r) => r.key === "TECH_SUPPORT_OFFICER")!;
    expect(support.permissions).not.toContain(permissionKey("PATIENT_ACCOUNTS", "VIEW"));
    expect(support.permissions).not.toContain(permissionKey("DOCUMENTS", "VIEW"));
    expect(support.permissions).toContain(permissionKey("USERS", "VIEW"));
  });

  it("a finance officer cannot edit clinical reports and a support officer cannot view patient records", () => {
    const finance = DEFAULT_ROLES.find((r) => r.key === "FINANCE_ADMIN")!;
    expect(finance.permissions).not.toContain(permissionKey("DOCUMENTS", "EDIT"));
    expect(finance.permissions).toContain(permissionKey("SUBSCRIPTIONS", "MANAGE"));
    const support = DEFAULT_ROLES.find((r) => r.key === "TECH_SUPPORT_OFFICER")!;
    expect(support.permissions).not.toContain(permissionKey("PATIENT_ACCOUNTS", "VIEW"));
    expect(support.permissions).not.toContain(permissionKey("DOCTORS", "APPROVE"));
  });

  it("ships the recommended departments and approval gates", () => {
    expect(DEFAULT_DEPARTMENTS.length).toBeGreaterThanOrEqual(11);
    expect(DEFAULT_APPROVAL_WORKFLOWS.map((w) => w.actionKey)).toContain("ASSIGN_PRIVILEGED_ROLE");
    expect(DEFAULT_APPROVAL_WORKFLOWS.map((w) => w.actionKey)).toContain("EXPORT_SENSITIVE_DATA");
  });
});

describe("resolvePermissions", () => {
  it("a super admin grant grants everything", () => {
    const permissions = resolvePermissions({ superAdmin: true, grants: [], overrides: [], now });
    expect(can(permissions, "SETTINGS", "CONFIGURE")).toBe(true);
    expect(can(permissions, "SECURITY", "MANAGE")).toBe(true);
  });

  it("a membership without roles grants nothing", () => {
    const permissions = resolvePermissions({ superAdmin: false, grants: [{ roleKeys: ["X"], permissionKeys: [] }], overrides: [], now });
    expect(visibleSections(permissions)).toHaveLength(0);
  });

  it("role permissions combine additively across roles", () => {
    const permissions = resolvePermissions({
      superAdmin: false,
      grants: [
        { roleKeys: ["A"], permissionKeys: ["USERS:VIEW", "USERS:EDIT"] },
        { roleKeys: ["B"], permissionKeys: ["USERS:VIEW", "FACILITIES:VIEW"] },
      ],
      overrides: [], now,
    });
    expect(can(permissions, "USERS", "EDIT")).toBe(true);
    expect(can(permissions, "FACILITIES", "VIEW")).toBe(true);
    expect(can(permissions, "FACILITIES", "EDIT")).toBe(false);
  });

  it("invalid permission keys are ignored, not crash", () => {
    const permissions = resolvePermissions({ superAdmin: false, grants: [{ roleKeys: ["A"], permissionKeys: ["NOT_A_KEY", "USERS:VIEW"] }], overrides: [], now });
    expect(can(permissions, "USERS", "VIEW")).toBe(true);
    expect(permissions.has("NOT_A_KEY")).toBe(false);
  });

  it("a DENY override beats role permissions and a GRANT override", () => {
    const permissions = resolvePermissions({
      superAdmin: false,
      grants: [{ roleKeys: ["A"], permissionKeys: ["USERS:VIEW"] }],
      overrides: [
        { permissionKey: "USERS:VIEW", effect: "DENY", expiresAt: null },
        { permissionKey: "FACILITIES:VIEW", effect: "GRANT", expiresAt: null },
      ],
      now,
    });
    expect(can(permissions, "USERS", "VIEW")).toBe(false);
    expect(can(permissions, "FACILITIES", "VIEW")).toBe(true);
  });

  it("expired grants and overrides contribute nothing", () => {
    const permissions = resolvePermissions({
      superAdmin: false,
      grants: [{ roleKeys: ["A"], permissionKeys: ["USERS:VIEW"] }],
      overrides: [{ permissionKey: "SECURITY:VIEW", effect: "GRANT", expiresAt: past }],
      now,
    });
    expect(can(permissions, "USERS", "VIEW")).toBe(true);
    expect(can(permissions, "SECURITY", "VIEW")).toBe(false);
  });

  it("a future-window override is not yet active", () => {
    // Overrides use expiry only; startsAt is handled by membership windows.
    const permissions = resolvePermissions({
      superAdmin: false, grants: [], overrides: [{ permissionKey: "USERS:VIEW", effect: "GRANT", expiresAt: future }], now,
    });
    expect(can(permissions, "USERS", "VIEW")).toBe(true);
  });
});
