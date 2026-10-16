import { describe, expect, it } from "vitest";
import { isAccountReady, pageAccessRedirect, ROLE_POLICY } from "./roles";

const active = { role: "PATIENT" as const, status: "ACTIVE" as const, onboardingComplete: true, deletedAt: null };

describe("shared account access policy", () => {
  it("requires a session", () => expect(pageAccessRedirect(null, ["PATIENT"])).toBe("/auth/login"));
  it("allows only an active completed account", () => {
    expect(pageAccessRedirect(active, ["PATIENT"])).toBeNull();
    expect(isAccountReady({ ...active, onboardingComplete: false })).toBe(false);
  });
  it.each(["SUSPENDED", "BANNED"] as const)("blocks %s before onboarding", status => {
    expect(pageAccessRedirect({ ...active, status, onboardingComplete: false }, ["PATIENT"])).toBe("/");
  });
  it("blocks soft-deleted accounts", () => {
    expect(pageAccessRedirect({ ...active, deletedAt: new Date() }, ["PATIENT"])).toBe("/");
  });
  it("keeps pending professionals in verification", () => {
    expect(pageAccessRedirect({ ...active, status: "PENDING" }, ["PATIENT"])).toBe("/auth/callback");
  });
  it.each(["PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"] as const)("routes %s to its own dashboard", role => {
    const other = role === "PATIENT" ? "ADMIN" : "PATIENT";
    expect(pageAccessRedirect({ ...active, role }, [other])).toBe(ROLE_POLICY[role].dashboard);
  });
  it("maps the facility portal without changing database roles", () => {
    expect(ROLE_POLICY.LAB_SCIENTIST).toEqual({ label: "Facility", dashboard: "/lab/dashboard" });
  });
});
