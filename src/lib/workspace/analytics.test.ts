import { describe, expect, it } from "vitest";
import { analyticsRange, analyticsRangeSchema, percentile } from "./analytics";
describe("bounded operational analytics", () => {
  it("defaults to 30 full UTC calendar days", () => {
    const range = analyticsRange({}, new Date("2026-10-16T20:00:00Z"));
    expect(range.calendarHours).toBe(720);
    expect(range.end.toISOString()).toBe("2026-10-17T00:00:00.000Z");
  });
  it("includes the entire requested end day", () => expect(analyticsRange({ from: "2026-10-16", to: "2026-10-16" }).calendarHours).toBe(24));
  it("rejects reversed and unbounded ranges", () => {
    expect(() => analyticsRange({ from: "2026-10-17", to: "2026-10-16" })).toThrow();
    expect(() => analyticsRange({ from: "2020-01-01", to: "2026-10-16" })).toThrow();
  });
  it("validates real calendar dates", () => expect(analyticsRangeSchema.safeParse({ from: "2026-02-30" }).success).toBe(false));
  it("uses observed nearest-rank percentiles and handles missing data", () => {
    expect(percentile([], .5)).toBeNull();
    expect(percentile([10, 2, 4, 8], .5)).toBe(4);
    expect(percentile([10, 2, 4, 8], .9)).toBe(10);
  });
});
