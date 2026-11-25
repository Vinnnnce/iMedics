import { describe, expect, it } from "vitest";
import { flagHigh, forecastDaily } from "./forecast";

const days = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));

describe("forecasting", () => {
  it("declines to forecast from too little history", () => expect(forecastDaily(days(10), Array(10).fill(5))).toBeNull());
  it("reproduces a flat series and widens nothing", () => {
    const f = forecastDaily(days(56), Array(56).fill(10))!;
    expect(f.forecast.every((v) => v === 10)).toBe(true);
    expect(f.noise).toBe(0);
  });
  it("learns a weekday pattern", () => {
    const d = days(56);
    const v = d.map((x) => (new Date(`${x}T00:00:00Z`).getUTCDay() === 1 ? 20 : 10));
    const f = forecastDaily(d, v)!;
    const next = new Date(`${d.at(-1)}T00:00:00Z`);
    f.forecast.forEach((p) => { next.setUTCDate(next.getUTCDate() + 1); expect(p).toBeGreaterThan(next.getUTCDay() === 1 ? 17 : 0); });
    expect(Math.max(...f.forecast)).toBeGreaterThan(Math.min(...f.forecast));
  });
  it("never predicts negative demand", () => {
    const f = forecastDaily(days(30), days(30).map((_, i) => (i % 2 ? 0 : 1)))!;
    expect(Math.min(...f.lower)).toBeGreaterThanOrEqual(0);
  });
  it("flags only unusually high points, and ignores missing ones", () => {
    const v: (number | null)[] = [5, 6, 5, 6, 5, 6, 5, 6, 5, 20, null, 6];
    expect(flagHigh(v, 8, 2).map((a) => a.index)).toEqual([9]);
  });
});
