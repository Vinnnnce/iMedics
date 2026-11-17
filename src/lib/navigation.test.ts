import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBottomNavigation, getRoleNavigation, PATIENT_ACCOUNT_NAVIGATION, PATIENT_HEALTH_LINKS } from "./navigation";
import { ROLE_POLICY } from "./roles";

describe("role-aware navigation", () => {
  it("does not assume a patient role before the account loads", () => {
    expect(getRoleNavigation(null)).toEqual([]);
    expect(getBottomNavigation(undefined)).toEqual([]);
  });
  it("does not expose patient clinical routes to admins", () => {
    expect(getRoleNavigation("ADMIN").some(item => item.href.startsWith("/patient") || item.href === "/dashboard")).toBe(false);
  });
  it("keeps the patient menu focused and groups supporting links under My Health or Account", () => {
    const primary = [
      ["/patient/dashboard", "Home"],
      ["/patient/appointments", "Appointments"],
      ["/patient/prescriptions", "Medications"],
      ["/patient/results", "Results"],
      ["/patient/documents", "Documents"],
      ["/patient/consult", "Messages"],
    ];
    const bottom = [
      ["/patient/dashboard", "Dashboard"],
      ["/patient/appointments", "Appointments"],
      ["/patient/prescriptions", "Medications"],
      ["/patient/consult", "Messages"],
    ];
    expect(getRoleNavigation("PATIENT").map(({ href, label }) => [href, label])).toEqual(primary);
    expect(getBottomNavigation("PATIENT").map(({ href, label }) => [href, label])).toEqual(bottom);
    expect(PATIENT_ACCOUNT_NAVIGATION.map(({ href, label }) => [href, label])).toEqual([
      ["/profile", "Profile"],
      ["/settings", "Settings & privacy"],
      ["/payments", "Payments"],
    ]);
    expect(PATIENT_HEALTH_LINKS.map(({ href, label }) => [href, label])).toEqual([
      ["/patient/dashboard", "Dashboard"],
      ["/patient/cases", "Care episodes"],
      ["/patient/history", "Health history"],
      ["/patient/results", "Test results"],
      ["/patient/prescriptions", "Prescriptions"],
      ["/patient/reminders", "Medication reminders"],
      ["/patient/documents", "Documents"],
      ["/patient/safety", "Medical alerts"],
      ["/patient/case-reports?tab=documents", "Hospital documents"],
      ["/patient/case-reports", "Case reports"],
    ]);
  });
  it.each(["PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"] as const)("has real desktop and mobile routes for %s", role => {
    expect(getRoleNavigation(role)[0].href).toBe(ROLE_POLICY[role].dashboard);
    expect(getBottomNavigation(role)[0].href).toBe(ROLE_POLICY[role].dashboard);
    for (const item of [
      ...getRoleNavigation(role),
      ...getBottomNavigation(role),
      ...(role === "PATIENT" ? [...PATIENT_ACCOUNT_NAVIGATION, ...PATIENT_HEALTH_LINKS] : []),
    ]) {
      // Tab links carry a ?tab= query; the route itself is what must exist.
      const route = item.href.split("?")[0];
      expect(existsSync(path.join(process.cwd(), "src/app", route, "page.tsx")), item.href).toBe(true);
    }
  });
});
