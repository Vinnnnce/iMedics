import { describe, expect, it } from "vitest";
const url = process.env.ANALYTICS_TEST_DATABASE_URL;
describe.skipIf(!url)("every dashboard executes against the real schema", () => {
  it("runs all dashboards for the seeded facility and an empty one", async () => {
    process.env.DATABASE_URL = url;
    const { prisma } = await import("@/lib/prisma");
    const { loadDashboard } = await import("./index");
    const { DASHBOARD_RULES } = await import("./scope");
    const { seedHospital } = await import("./testing/fixtures");
    const fx = await seedHospital(prisma, `smoke${Math.random().toString(36).slice(2, 6)}`);
    const fac = await prisma.labStaffProfile.findUnique({ where: { id: fx.facilityId } });
    expect(fac).toBeTruthy();
    const calendar = { timeZone: "Africa/Lagos", weekStartsOn: 1, financialYearStartMonth: 1 };
    for (const kind of ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"] as const) {
      const scope = { user: { id: fac!.userId, role: "LAB_SCIENTIST" }, facility: fac!, facilityName: "x", kind, staffId: null, permissions: ["VIEW_ANALYTICS", "VIEW_REVENUE", "MANAGE_INSURANCE"], accessLevel: "FULL", departmentIds: null, calendar, canViewFinancial: true, canIdentifyPatients: true, limitedToDepartments: false } as never;
      for (const key of Object.keys(DASHBOARD_RULES)) {
        const rule = DASHBOARD_RULES[key as keyof typeof DASHBOARD_RULES];
        if (!rule.kinds.includes(kind)) continue;
        const p = await loadDashboard(scope, key as never, { preset: "CUSTOM", from: "2026-11-01", to: "2026-11-30" }, { now: new Date("2026-11-30T12:00:00Z"), skipCache: true });
        expect(p.kpis.every((k) => k.label && k.unit)).toBe(true);
        expect(JSON.stringify(p)).not.toContain("NaN");
      }
    }
  }, 120_000);
});

describe.skipIf(!url)("drill-downs", () => {
  it("every drill-down executes, preserves the period, and de-identifies by default", async () => {
    process.env.DATABASE_URL = url;
    const { prisma } = await import("@/lib/prisma");
    const { loadDrilldown, DRILLDOWNS } = await import("./drilldown");
    const { resolveRange } = await import("./periods");
    const { seedHospital } = await import("./testing/fixtures");
    const fx = await seedHospital(prisma, `drill${Math.random().toString(36).slice(2, 6)}`);
    const fac = await prisma.labStaffProfile.findUnique({ where: { id: fx.facilityId } });
    const calendar = { timeZone: "Africa/Lagos", weekStartsOn: 1, financialYearStartMonth: 1 };
    const now = new Date("2026-11-30T12:00:00Z");
    const ctx = { now, dept: null, range: resolveRange({ preset: "CUSTOM", from: "2026-11-01", to: "2026-11-30", compare: "NONE" }, calendar, now), scope: { user: { id: fx.ownerId, role: "LAB_SCIENTIST" }, facility: fac!, facilityName: "x", kind: "HOSPITAL", staffId: null, permissions: ["VIEW_ANALYTICS", "VIEW_REVENUE"], accessLevel: "FULL", departmentIds: null, calendar, canViewFinancial: true, canIdentifyPatients: true, limitedToDepartments: false } } as never;
    for (const key of Object.keys(DRILLDOWNS)) {
      const page = await loadDrilldown(ctx, key, 1, 10, true);
      expect(page.rows.length).toBeLessThanOrEqual(10);
      expect(page.period.startDate).toBe("2026-11-01");
    }
    const adm = await loadDrilldown(ctx, "hospital.admissions", 1, 50, false);
    expect(adm.total).toBe(5);
    expect(adm.identified).toBe(false);
    expect(adm.columns.some((c) => c.key === "patient")).toBe(false);
    expect(JSON.stringify(adm.rows)).not.toContain("QA-");
    const named = await loadDrilldown(ctx, "hospital.admissions", 1, 50, true);
    expect(named.rows[0]).toHaveProperty("patient");
    expect((await loadDrilldown(ctx, "mortality.deaths", 1, 50)).total).toBe(1);
    await expect(loadDrilldown(ctx, "nope")).rejects.toThrow();
  }, 120_000);
});
