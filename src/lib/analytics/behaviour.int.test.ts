import { describe, expect, it } from "vitest";

const url = process.env.ANALYTICS_TEST_DATABASE_URL;

describe.skipIf(!url)("analytics behaviour against the real schema", () => {
  const calendar = { timeZone: "Africa/Lagos", weekStartsOn: 1, financialYearStartMonth: 1 };
  const now = new Date("2026-11-30T12:00:00Z");

  async function setup() {
    process.env.DATABASE_URL = url;
    const { prisma } = await import("@/lib/prisma");
    const { seedHospital } = await import("./testing/fixtures");
    const { resolveRange } = await import("./periods");
    const fx = await seedHospital(prisma, `beh${Math.random().toString(36).slice(2, 6)}`);
    const facility = (await prisma.labStaffProfile.findUnique({ where: { id: fx.facilityId } }))!;
    const scope = (id = facility, extra: object = {}) => ({ user: { id: fx.ownerId, role: "LAB_SCIENTIST" }, facility: id, facilityName: "x", kind: "HOSPITAL", staffId: null, permissions: ["VIEW_ANALYTICS", "VIEW_REVENUE"], accessLevel: "FULL", departmentIds: null, calendar, canViewFinancial: true, canIdentifyPatients: true, limitedToDepartments: false, ...extra }) as never;
    const range = resolveRange({ preset: "CUSTOM", from: "2026-11-01", to: "2026-11-30", compare: "NONE" }, calendar, now);
    return { prisma, fx, facility, scope, range };
  }

  it("never shows one facility's records to another", async () => {
    const { prisma, fx, scope, range } = await setup();
    const { hospitalFigures } = await import("./hospital");
    const other = (await prisma.labStaffProfile.findUnique({ where: { id: fx.otherFacilityId } }))!;
    const f = await hospitalFigures({ scope: scope(other), range, dept: null, now }, range.current);
    expect(f.admissions_total.value).toBe(0);
    expect(f.encounters_total.value).toBe(0);
    expect(f.inpatient_mortality_rate.value).toBeNull(); // no denominator is "no data", not 0%
  });

  it("filters every hospital figure to a department-limited viewer's wards", async () => {
    const { scope, range } = await setup();
    const { hospitalFigures } = await import("./hospital");
    const ctx = { scope: scope(undefined, { departmentIds: ["x"] }), range, now, dept: { wardIds: [], wardNames: ["ICU"], departmentNames: ["Nowhere"] } };
    const f = await hospitalFigures(ctx, range.current);
    expect(f.admissions_total.value).toBe(1);
    expect(f.inpatient_deaths.value).toBe(1);
    expect(f.encounters_total.value).toBe(0);
  });

  it("measures actual performance against the facility's own targets", async () => {
    const { prisma, fx, facility, scope } = await setup();
    await prisma.analyticsPerformanceTarget.create({ data: { facilityId: fx.facilityId, metricKey: "alos", scopeKey: "FACILITY", targetValue: 7, direction: "AT_MOST", createdById: fx.ownerId } });
    await prisma.analyticsPerformanceTarget.create({ data: { facilityId: fx.facilityId, metricKey: "readmission_rate", scopeKey: "FACILITY", targetValue: 10, direction: "AT_MOST", createdById: fx.ownerId } });
    const { loadDashboard } = await import("./index");
    const p = await loadDashboard(scope(facility), "hospital", { preset: "CUSTOM", from: "2026-11-01", to: "2026-11-30", compare: "NONE" }, { now, skipCache: true });
    expect(p.kpis.find((k) => k.key === "alos")?.target?.status).toBe("MET");
    expect(p.kpis.find((k) => k.key === "readmission_rate")?.target?.status).toBe("MISSED");
    expect(p.sections.some((s) => s.id === "targets")).toBe(true);
  });

  it("caches aggregates and serves the cached copy", async () => {
    const { facility, scope } = await setup();
    const { loadDashboard } = await import("./index");
    const input = { preset: "CUSTOM" as const, from: "2026-11-01", to: "2026-11-30", compare: "NONE" as const };
    const first = await loadDashboard(scope(facility), "hospital", input, { now });
    const second = await loadDashboard(scope(facility), "hospital", input, { now });
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(JSON.stringify(second)).not.toContain("QA-");
  });

  it("hides financial KPIs from staff without the revenue permission", async () => {
    const { facility, scope } = await setup();
    const { loadDashboard } = await import("./index");
    const noFin = scope(facility, { permissions: ["VIEW_ANALYTICS"], canViewFinancial: false });
    await expect(loadDashboard(noFin, "financial", {}, { now, skipCache: true })).rejects.toThrow();
    const o = await loadDashboard(noFin, "overview", { preset: "LAST_MONTH" }, { now, skipCache: true });
    expect(o.kpis.some((k) => k.key === "revenue_total")).toBe(false);
  });

  it("every KPI on every dashboard is defined in the metric registry", async () => {
    const { facility, scope } = await setup();
    const { loadDashboard } = await import("./index");
    const { getMetric } = await import("./registry");
    const { DASHBOARD_RULES } = await import("./scope");
    for (const kind of ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"] as const) {
      for (const key of Object.keys(DASHBOARD_RULES) as (keyof typeof DASHBOARD_RULES)[]) {
        if (!DASHBOARD_RULES[key].kinds.includes(kind)) continue;
        const p = await loadDashboard(scope(facility, { kind }), key, { preset: "LAST_MONTH" }, { now, skipCache: true });
        for (const k of p.kpis) expect(getMetric(k.key), `${kind}/${key}/${k.key}`).toBeTruthy();
      }
    }
  }, 120_000);

  it("compares a month in progress like-for-like", async () => {
    const { facility, scope } = await setup();
    const { loadDashboard } = await import("./index");
    const p = await loadDashboard(scope(facility), "hospital", { preset: "THIS_MONTH", compare: "PREVIOUS_PERIOD" }, { now: new Date("2026-11-15T12:00:00Z"), skipCache: true });
    expect(p.range.likeForLike).toBe(true);
    expect(p.range.previous?.endDate).toBe("2026-10-15");
    expect(p.kpis.find((k) => k.key === "admissions_total")?.change).toBeTruthy();
  });
});
