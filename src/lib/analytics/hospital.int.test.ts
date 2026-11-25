import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Verifies hospital metric calculations against a hand-worked synthetic dataset
 * (see testing/fixtures.ts). Runs only when ANALYTICS_TEST_DATABASE_URL points at a migrated,
 * disposable database whose name ends in _test.
 */
const url = process.env.ANALYTICS_TEST_DATABASE_URL;
if (url && !new URL(url).pathname.endsWith("_test")) throw new Error("Analytics integration tests require a disposable *_test database");

describe.skipIf(!url)("hospital analytics against a verified synthetic dataset", () => {
  const run = Math.random().toString(36).slice(2, 8);
  let ctx: import("./core").Ctx;
  let hospitalFigures: typeof import("./hospital").hospitalFigures;
  let hospitalDashboard: typeof import("./hospital").hospitalDashboard;
  let mortalityDashboard: typeof import("./hospital").mortalityDashboard;
  let prisma: typeof import("@/lib/prisma").prisma;
  let fx: import("./testing/fixtures").Fixture;
  let periods: typeof import("./periods");

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ prisma } = await import("@/lib/prisma"));
    ({ hospitalFigures, hospitalDashboard, mortalityDashboard } = await import("./hospital"));
    periods = await import("./periods");
    const { seedHospital } = await import("./testing/fixtures");
    fx = await seedHospital(prisma, run);
    const calendar = { timeZone: "Africa/Lagos", weekStartsOn: 1, financialYearStartMonth: 1 };
    const now = new Date("2026-11-30T12:00:00Z");
    const range = periods.resolveRange({ preset: "CUSTOM", from: "2026-11-01", to: "2026-11-30", compare: "NONE" }, calendar, now);
    ctx = {
      now, range, dept: null,
      scope: { user: { id: fx.ownerId, role: "LAB_SCIENTIST" }, facility: { id: fx.facilityId, laboratoryName: "x" }, facilityName: "x", kind: "HOSPITAL", staffId: null, permissions: [], accessLevel: "FULL", departmentIds: null, calendar, canViewFinancial: true, canIdentifyPatients: true, limitedToDepartments: false },
    };
  }, 60_000);

  afterAll(async () => {
    if (!prisma) return;
    const { cleanup } = await import("./testing/fixtures");
    await cleanup(prisma, run);
  });

  it("counts admissions on admission date, excluding cancelled and earlier stays", async () => {
    const f = await hospitalFigures(ctx, ctx.range.current);
    expect(f.admissions_total.value).toBe(5);
    expect(f.admissions_emergency.value).toBe(2);
  });

  it("separates deaths, live discharges and transfers, each with its own definition", async () => {
    const f = await hospitalFigures(ctx, ctx.range.current);
    expect(f.discharges_total.value).toBe(3);
    expect(f.inpatient_deaths.value).toBe(1);
    expect(f.transfers_out.value).toBe(1);
  });

  it("mortality uses discharged-alive plus died as denominator, and transfers are excluded", async () => {
    const f = await hospitalFigures(ctx, ctx.range.current);
    expect(f.inpatient_mortality_rate).toMatchObject({ numerator: 1, denominator: 4, value: 25 });
  });

  it("length of stay uses discharged stays only", async () => {
    const f = await hospitalFigures(ctx, ctx.range.current);
    expect(f.alos).toMatchObject({ denominator: 4, value: 5.3 });
    expect(f.median_los.value).toBe(4.5);
  });

  it("readmission counts admissions within 30 days of a prior live discharge", async () => {
    const f = await hospitalFigures(ctx, ctx.range.current);
    expect(f.readmission_rate).toMatchObject({ numerator: 1, denominator: 5, value: 20 });
  });

  it("discharge-summary completion and pending summaries", async () => {
    const f = await hospitalFigures(ctx, ctx.range.current);
    expect(f.discharge_summary_completion).toMatchObject({ numerator: 3, denominator: 4, value: 75 });
    expect(f.pending_discharge_summaries.value).toBe(1);
  });

  it("distinguishes unique patients and new patients from encounters", async () => {
    const f = await hospitalFigures(ctx, ctx.range.current);
    expect(f.encounters_total.value).toBe(6);
    expect(f.unique_patients.value).toBe(5);
    expect(f.new_patients.value).toBe(4);
    expect(f.emergency_arrivals.value).toBe(3);
    expect(f.outpatient_encounters.value).toBe(1);
    expect(f.ward_transfers.value).toBe(1);
  });

  it("estimates period bed occupancy from overlapping stays", async () => {
    const f = await hospitalFigures(ctx, ctx.range.current);
    expect(f.bed_occupancy_period.value).toBeCloseTo(43.5, 0);
  });

  it("does not double count across adjacent periods", async () => {
    const a = periods.resolveRange({ preset: "CUSTOM", from: "2026-11-01", to: "2026-11-15", compare: "NONE" }, ctx.scope.calendar, ctx.now).current;
    const b = periods.resolveRange({ preset: "CUSTOM", from: "2026-11-16", to: "2026-11-30", compare: "NONE" }, ctx.scope.calendar, ctx.now).current;
    const [fa, fb, all] = await Promise.all([hospitalFigures(ctx, a), hospitalFigures(ctx, b), hospitalFigures(ctx, ctx.range.current)]);
    expect(fa.admissions_total.value! + fb.admissions_total.value!).toBe(all.admissions_total.value);
    expect(fa.encounters_total.value! + fb.encounters_total.value!).toBe(all.encounters_total.value);
  });

  it("builds the dashboard with bed map and registered KPIs only", async () => {
    const d = await hospitalDashboard(ctx);
    const occ = d.kpis.find((k) => k.key === "bed_occupancy_now");
    expect(occ).toMatchObject({ numerator: 1, denominator: 3 });
    const map = d.sections.find((s) => s.id === "bed-map")!.visual;
    expect(map.type).toBe("beds");
    expect(d.gaps.length).toBeGreaterThan(0);
  });

  it("mortality dashboard hides small cells and never attributes to individuals", async () => {
    const m = await mortalityDashboard(ctx);
    const age = m.sections.find((s) => s.id === "by-age")!;
    expect(JSON.stringify(age)).not.toContain('"value":1');
    expect(JSON.stringify(m)).not.toMatch(/doctor|nurse/i.test("") ? "" : /admittingDoctor/);
  });
});
