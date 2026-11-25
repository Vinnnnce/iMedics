import { describe, expect, it } from "vitest";
import { ageBand, change, evaluateTarget, minutesBetween, percentile, ratio, summariseDurations, suppressSmall } from "./stats";

describe("rates", () => {
  it("keeps numerator and denominator and never turns missing into zero", () => {
    expect(ratio(1, 4)).toEqual({ numerator: 1, denominator: 4, percent: 25 });
    expect(ratio(0, 0).percent).toBeNull();
  });
  it("does not report a percentage change from a zero or missing baseline", () => {
    expect(change(5, 0)).toMatchObject({ delta: 5, percent: null, direction: "UP" });
    expect(change(null, 3).direction).toBe("UNKNOWN");
    expect(change(110, 100)).toMatchObject({ delta: 10, percent: 10 });
    expect(change(90, 100).direction).toBe("DOWN");
  });
});

describe("durations", () => {
  it("summarises and ignores impossible values", () => {
    expect(summariseDurations([10, 20, 30, 40, -5, Number.NaN])).toEqual({ count: 4, mean: 25, median: 25, p90: 37 });
    expect(summariseDurations([]).mean).toBeNull();
  });
  it("interpolates percentiles", () => expect(percentile([1, 2, 3, 4], 50)).toBe(2.5));
  it("returns null when an end is missing or the order is impossible", () => {
    expect(minutesBetween(new Date(0), null)).toBeNull();
    expect(minutesBetween(new Date(60_000), new Date(0))).toBeNull();
    expect(minutesBetween(new Date(0), new Date(90_000))).toBe(1.5);
  });
});

describe("privacy", () => {
  it("hides cells with fewer than 5 cases but keeps zeros", () => {
    const { rows, suppressed } = suppressSmall([{ label: "a", count: 3 }, { label: "b", count: 9 }, { label: "c", count: 0 }]);
    expect(suppressed).toBe(1);
    expect(rows[0]).toMatchObject({ count: null, suppressed: true });
    expect(rows[1].count).toBe(9);
  });
  it("bands ages on the right side of a birthday", () => {
    const at = new Date("2026-06-01T00:00:00Z");
    expect(ageBand(new Date("2021-06-02T00:00:00Z"), at)).toBe("0–4");
    expect(ageBand(new Date("2021-06-01T00:00:00Z"), at)).toBe("5–17");
    expect(ageBand(null, at)).toBe("Unknown");
  });
});

describe("targets", () => {
  it("judges 'at least' and 'at most' targets, with a near band", () => {
    expect(evaluateTarget(95, 90, "AT_LEAST").status).toBe("MET");
    expect(evaluateTarget(85, 90, "AT_LEAST").status).toBe("NEAR");
    expect(evaluateTarget(50, 90, "AT_LEAST").status).toBe("MISSED");
    expect(evaluateTarget(40, 60, "AT_MOST").status).toBe("MET");
    expect(evaluateTarget(null, 60, "AT_MOST").status).toBe("NO_DATA");
  });
});
