import { describe, expect, it } from "vitest";
import { evaluatePanel, normalizeUnit } from "./rule-engine";

const value = (over: Partial<Parameters<typeof evaluatePanel>[0][number]>) => ({
  code: "GLU",
  name: "Glucose",
  value: 90,
  unit: "mg/dL",
  refLow: 70,
  refHigh: 99,
  ...over,
});

describe("rule engine", () => {
  it("flags a critically low glucose in mg/dL", () => {
    const r = evaluatePanel([value({ value: 35 })]);
    expect(r.critical).toHaveLength(1);
    expect(r.critical[0].flag).toBe("CRITICAL_LOW");
  });

  it("never applies a mg/dL threshold to a mmol/L value", () => {
    const r = evaluatePanel([value({ value: 5.5, unit: "mmol/L", refLow: 3.9, refHigh: 5.6 })]);
    expect(r.critical).toHaveLength(0);
    expect(r.unitNotes).toHaveLength(1);
  });

  it("treats mEq/L as mmol/L for potassium", () => {
    const r = evaluatePanel([value({ code: "K", name: "Potassium", value: 7.2, unit: "mEq/L", refLow: 3.5, refHigh: 5.1 })]);
    expect(r.critical).toHaveLength(1);
  });

  it("respects a reference bound of zero", () => {
    const r = evaluatePanel([value({ code: "X", value: 0, unit: "", refLow: 0, refHigh: 5 })]);
    expect(r.nonCritical).toHaveLength(0);
  });

  it("normalises equivalent cell-count units", () => {
    expect(normalizeUnit("K/uL")).toBe("x10^9/l");
    expect(normalizeUnit("10^9/L")).toBe("x10^9/l");
  });

  it("flags non-critical values outside the reference range", () => {
    const r = evaluatePanel([value({ code: "WBC", name: "WBC", value: 12, unit: "x10^9/L", refLow: 4, refHigh: 11 })]);
    expect(r.nonCritical.map((f) => f.flag)).toEqual(["HIGH"]);
  });

  it("reports trends only when units match", () => {
    const prev = new Map([["HGB", { value: 10, unit: "g/dL", date: new Date("2026-01-01") }]]);
    const same = evaluatePanel([value({ code: "HGB", name: "Hb", value: 12, unit: "g/dL", refLow: 12, refHigh: 17 })], prev);
    expect(same.trends.HGB?.direction).toBe("increasing");
    const other = evaluatePanel([value({ code: "HGB", name: "Hb", value: 120, unit: "g/L", refLow: 120, refHigh: 170 })], prev);
    expect(other.trends.HGB).toBeUndefined();
  });
});
