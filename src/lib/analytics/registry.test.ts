import { describe, expect, it } from "vitest";
import { METRICS, SUPPORTING_METRICS, getMetric, requireMetric, TARGETABLE_METRICS } from "./registry";
import { DASHBOARD_RULES, assertDashboardAllowed, dashboardsFor } from "./scope";

describe("metric definition registry", () => {
  it("has unique keys and complete definitions", () => {
    const keys = [...METRICS, ...SUPPORTING_METRICS].map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const m of METRICS) {
      expect(m.description.length, m.key).toBeGreaterThan(10);
      expect(m.formula, m.key).toBeTruthy();
      expect(m.dataSource, m.key).toBeTruthy();
      expect(m.eventDate, m.key).toBeTruthy();
      expect(m.inclusion && m.exclusion, m.key).toBeTruthy();
      expect(m.lastUpdated, m.key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it("gives every rate a numerator and a denominator", () => {
    for (const m of METRICS.filter((x) => x.unit === "percent" && !x.requires)) {
      expect(m.numerator, m.key).toBeTruthy();
      expect(m.denominator, m.key).toBeTruthy();
    }
  });
  it("keeps financial metrics behind a financial permission", () => {
    for (const k of ["revenue_total", "revenue_outstanding", "refunds_total", "stock_value", "po_spend"]) expect(requireMetric(k).requires, k).toBeTruthy();
  });
  it("only allows targets on metrics where a target means something", () => {
    expect(TARGETABLE_METRICS.length).toBeGreaterThan(10);
    expect(getMetric("admissions_total")?.targetable).toBe(false);
    expect(getMetric("inpatient_mortality_rate")?.targetable).toBe(false);
  });
  it("defines the documented mortality formula with its denominator", () => {
    const m = requireMetric("inpatient_mortality_rate");
    expect(m.denominator).toMatch(/DISCHARGED/);
    expect(m.caveat).toMatch(/case mix/i);
  });
  it("throws for an unregistered metric", () => expect(() => requireMetric("nope")).toThrow());
});

describe("dashboard authorisation", () => {
  const base = { kind: "HOSPITAL" as const, permissions: ["VIEW_ANALYTICS"] as never, accessLevel: "FULL", departmentIds: null };
  it("requires the analytics permission", () => {
    expect(() => assertDashboardAllowed({ ...base, permissions: [] }, "hospital")).toThrow();
    expect(assertDashboardAllowed(base, "hospital").key).toBe("hospital");
  });
  it("hides financial analytics without the revenue permission", () => {
    expect(() => assertDashboardAllowed(base, "financial")).toThrow();
    expect(assertDashboardAllowed({ ...base, permissions: ["VIEW_ANALYTICS", "VIEW_REVENUE"] as never }, "financial").key).toBe("financial");
  });
  it("limits dashboards to the organisation type", () => {
    expect(() => assertDashboardAllowed({ ...base, kind: "PHARMACY" }, "hospital")).toThrow();
    expect(() => assertDashboardAllowed({ ...base, kind: "LABORATORY" }, "pharmacy")).toThrow();
    expect(() => assertDashboardAllowed({ ...base, kind: "PHARMACY" }, "pharmacy")).not.toThrow();
    expect(() => assertDashboardAllowed({ ...base, kind: "DIAGNOSTIC_CENTRE" }, "diagnostic")).not.toThrow();
  });
  it("gives limited-access staff no aggregate analytics", () => {
    expect(() => assertDashboardAllowed({ ...base, accessLevel: "LIMITED" }, "hospital")).toThrow();
  });
  it("lets department-limited staff open only department-filterable dashboards", () => {
    const scoped = { ...base, accessLevel: "DEPARTMENT", departmentIds: ["d1"] };
    expect(() => assertDashboardAllowed(scoped, "hospital")).not.toThrow();
    expect(() => assertDashboardAllowed(scoped, "laboratory")).toThrow();
    expect(() => assertDashboardAllowed(scoped, "financial")).toThrow();
    expect(dashboardsFor(scoped).every((d) => d.departmentScoped)).toBe(true);
  });
  it("covers every dashboard key with a rule", () => {
    for (const [k, r] of Object.entries(DASHBOARD_RULES)) expect(r.key).toBe(k);
  });
});
