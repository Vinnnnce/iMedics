import { describe, expect, it } from "vitest";
import {
  permissionsForRole,
  roleHasPermission,
  FACILITY_PERMISSIONS,
  generateInviteToken,
  credentialExpiryState,
  dueReminderStage,
  daysUntil,
} from "./facility-staff";

describe("facility role permissions", () => {
  it("gives the owner every permission", () => {
    expect(permissionsForRole("OWNER")).toHaveLength(FACILITY_PERMISSIONS.length);
  });

  it("follows least privilege for clinical roles", () => {
    // A receptionist registers patients and takes payments but never touches results.
    expect(roleHasPermission("RECEPTIONIST", "REGISTER_PATIENTS")).toBe(true);
    expect(roleHasPermission("RECEPTIONIST", "TAKE_PAYMENTS")).toBe(true);
    expect(roleHasPermission("RECEPTIONIST", "ENTER_RESULTS")).toBe(false);
    expect(roleHasPermission("RECEPTIONIST", "RELEASE_RESULTS")).toBe(false);

    // A lab scientist processes samples and results but cannot manage staff or payouts.
    expect(roleHasPermission("LAB_SCIENTIST", "ENTER_RESULTS")).toBe(true);
    expect(roleHasPermission("LAB_SCIENTIST", "VERIFY_RESULTS")).toBe(true);
    expect(roleHasPermission("LAB_SCIENTIST", "RELEASE_RESULTS")).toBe(true);
    expect(roleHasPermission("LAB_SCIENTIST", "MANAGE_STAFF")).toBe(false);
    expect(roleHasPermission("LAB_SCIENTIST", "MANAGE_PAYOUTS")).toBe(false);

    // A lab assistant only handles sample processing.
    expect(roleHasPermission("LAB_ASSISTANT", "PROCESS_ORDERS")).toBe(true);
    expect(roleHasPermission("LAB_ASSISTANT", "ENTER_RESULTS")).toBe(false);
  });

  it("keeps the compliance officer read-only", () => {
    expect(roleHasPermission("COMPLIANCE_OFFICER", "VIEW_AUDIT")).toBe(true);
    expect(roleHasPermission("COMPLIANCE_OFFICER", "MANAGE_CREDENTIALS")).toBe(true);
    for (const permission of ["MANAGE_STAFF", "ENTER_RESULTS", "TAKE_PAYMENTS", "MANAGE_BOOKINGS"] as const) {
      expect(roleHasPermission("COMPLIANCE_OFFICER", permission)).toBe(false);
    }
  });

  it("keeps payout management away from managers", () => {
    expect(roleHasPermission("FACILITY_MANAGER", "MANAGE_STAFF")).toBe(true);
    expect(roleHasPermission("FACILITY_MANAGER", "MANAGE_PAYOUTS")).toBe(false);
    expect(roleHasPermission("ACCOUNTANT", "VIEW_REVENUE")).toBe(true);
    expect(roleHasPermission("ACCOUNTANT", "MANAGE_SERVICES")).toBe(false);
  });

  it("generates unique, URL-safe invite tokens", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(b).not.toBe(a);
  });
});

describe("credential expiry tracking", () => {
  const now = new Date("2026-10-17T00:00:00Z");

  it("classifies expiry states", () => {
    expect(credentialExpiryState({ expiryDate: "2026-10-16" }, now)).toBe("EXPIRED");
    expect(credentialExpiryState({ expiryDate: "2026-10-20" }, now)).toBe("EXPIRING_SOON");
    expect(credentialExpiryState({ expiryDate: "2027-06-01" }, now)).toBe("VALID");
    expect(credentialExpiryState({ expiryDate: null }, now)).toBe("UNKNOWN");
  });

  it("never treats a missing expiry date as valid", () => {
    expect(credentialExpiryState({ expiryDate: null }, now)).not.toBe("VALID");
  });

  it("computes whole days until a date", () => {
    expect(daysUntil(new Date("2026-10-18T00:00:00Z"), now)).toBe(1);
    expect(daysUntil(new Date("2026-10-10T00:00:00Z"), now)).toBe(-7);
  });

  it("picks the tightest due reminder threshold", () => {
    // 45 days out: both the 90-day and 60-day thresholds have been crossed; 60 is the tightest.
    expect(dueReminderStage({ expiryDate: new Date("2026-12-01"), lastReminderStage: null }, now)).toBe(60);
    // 75 days out: only the 90-day threshold has been crossed.
    expect(dueReminderStage({ expiryDate: new Date("2026-12-31"), lastReminderStage: null }, now)).toBe(90);
    // 25 days out: 90, 60 and 30 are all due; the tightest wins.
    expect(dueReminderStage({ expiryDate: new Date("2026-11-11"), lastReminderStage: null }, now)).toBe(30);
    // 5 days out: the 7-day threshold.
    expect(dueReminderStage({ expiryDate: new Date("2026-10-22"), lastReminderStage: null }, now)).toBe(7);
    // Far from expiry: nothing due.
    expect(dueReminderStage({ expiryDate: new Date("2027-06-01"), lastReminderStage: null }, now)).toBeNull();
    // Already expired: the dispatcher handles expiry separately.
    expect(dueReminderStage({ expiryDate: new Date("2026-10-01"), lastReminderStage: null }, now)).toBeNull();
  });
});
