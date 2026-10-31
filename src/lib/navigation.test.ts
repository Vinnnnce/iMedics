import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getBottomNavigation, getRoleNavigation } from "./navigation";
import { ROLE_POLICY } from "./roles";

describe("role-aware navigation", () => {
  it("does not assume a patient role before the account loads", () => {
    expect(getRoleNavigation(null)).toEqual([]);
    expect(getBottomNavigation(undefined)).toEqual([]);
  });
  it("does not expose patient clinical routes to admins", () => {
    expect(getRoleNavigation("ADMIN").some(item => item.href.startsWith("/patient") || item.href === "/dashboard")).toBe(false);
  });
  it.each(["PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"] as const)("has real desktop and mobile routes for %s", role => {
    expect(getRoleNavigation(role)[0].href).toBe(ROLE_POLICY[role].dashboard);
    expect(getBottomNavigation(role)[0].href).toBe(ROLE_POLICY[role].dashboard);
    for (const item of [...getRoleNavigation(role), ...getBottomNavigation(role)]) {
      // Tab links carry a ?tab= query; the route itself is what must exist.
      const route = item.href.split("?")[0];
      expect(existsSync(path.join(process.cwd(), "src/app", route, "page.tsx")), item.href).toBe(true);
    }
  });
});
