import { describe, expect, it } from "vitest";
import { bucketOf, bucketStarts, chooseGranularity, localDateOf, localMidnight, PeriodError, resolveRange, startOfFinancialYear, startOfQuarter, type CalendarSettings } from "./periods";

const lagos: CalendarSettings = { timeZone: "Africa/Lagos", weekStartsOn: 1, financialYearStartMonth: 1 };
const iso = (d: Date) => d.toISOString();

describe("time zones", () => {
  it("local midnight in Lagos (UTC+1) is 23:00 UTC the day before", () => {
    expect(iso(localMidnight({ y: 2026, m: 11, d: 1 }, "Africa/Lagos"))).toBe("2026-10-31T23:00:00.000Z");
  });
  it("handles daylight saving: New York midnight differs before and after the change", () => {
    expect(iso(localMidnight({ y: 2026, m: 3, d: 7 }, "America/New_York"))).toBe("2026-03-07T05:00:00.000Z");
    expect(iso(localMidnight({ y: 2026, m: 3, d: 9 }, "America/New_York"))).toBe("2026-03-09T04:00:00.000Z");
  });
  it("assigns an instant to the local calendar day, not the UTC day", () => {
    expect(localDateOf(new Date("2026-10-31T23:30:00Z"), "Africa/Lagos")).toEqual({ y: 2026, m: 11, d: 1 });
  });
});

describe("period resolution", () => {
  const now = new Date("2026-11-24T10:00:00Z"); // Tuesday
  it("resolves this week using the facility's week start", () => {
    expect(resolveRange({ preset: "THIS_WEEK", compare: "NONE" }, lagos, now).current.startDate).toBe("2026-11-23");
    expect(resolveRange({ preset: "THIS_WEEK", compare: "NONE" }, { ...lagos, weekStartsOn: 0 }, now).current.startDate).toBe("2026-11-22");
  });
  it("uses half-open boundaries so adjacent periods never overlap", () => {
    const a = resolveRange({ preset: "LAST_MONTH", compare: "NONE" }, lagos, now).current;
    const b = resolveRange({ preset: "THIS_MONTH", compare: "NONE" }, lagos, now).current;
    expect(a.end.getTime()).toBe(b.start.getTime());
    expect([a.startDate, a.endDate]).toEqual(["2026-10-01", "2026-10-31"]);
  });
  it("compares a month in progress with the same number of days of the previous month", () => {
    const r = resolveRange({ preset: "THIS_MONTH" }, lagos, now);
    expect(r.likeForLike).toBe(true);
    expect([r.previous!.startDate, r.previous!.endDate]).toEqual(["2026-10-01", "2026-10-24"]);
  });
  it("compares a finished month with the whole previous month", () => {
    const r = resolveRange({ preset: "LAST_MONTH" }, lagos, now);
    expect(r.likeForLike).toBe(false);
    expect([r.previous!.startDate, r.previous!.endDate]).toEqual(["2026-09-01", "2026-09-30"]);
  });
  it("supports year-over-year and custom baselines", () => {
    const yoy = resolveRange({ preset: "LAST_MONTH", compare: "YEAR_OVER_YEAR" }, lagos, now);
    expect([yoy.previous!.startDate, yoy.previous!.endDate]).toEqual(["2025-10-01", "2025-10-31"]);
    const custom = resolveRange({ preset: "LAST_MONTH", compare: "CUSTOM", compareFrom: "2026-01-01", compareTo: "2026-01-31" }, lagos, now);
    expect(custom.previous!.startDate).toBe("2026-01-01");
  });
  it("shifts a custom range by its own length", () => {
    const r = resolveRange({ preset: "CUSTOM", from: "2026-11-01", to: "2026-11-10", compare: "PREVIOUS_PERIOD" }, lagos, new Date("2026-12-30T00:00:00Z"));
    expect([r.previous!.startDate, r.previous!.endDate]).toEqual(["2026-10-22", "2026-10-31"]);
  });
  it("counts quarters from the financial-year start", () => {
    const fy: CalendarSettings = { ...lagos, financialYearStartMonth: 4 };
    expect(startOfFinancialYear({ y: 2026, m: 2, d: 10 }, 4)).toEqual({ y: 2025, m: 4, d: 1 });
    expect(startOfQuarter({ y: 2026, m: 11, d: 24 }, 4)).toEqual({ y: 2026, m: 10, d: 1 });
    const r = resolveRange({ preset: "THIS_QUARTER", compare: "NONE" }, fy, now);
    expect([r.current.startDate, r.current.endDate]).toEqual(["2026-10-01", "2026-12-31"]);
  });
  it("rejects impossible input", () => {
    expect(() => resolveRange({ preset: "CUSTOM", from: "2026-02-30", to: "2026-03-01" }, lagos, now)).toThrow(PeriodError);
    expect(() => resolveRange({ preset: "CUSTOM", from: "2026-03-02", to: "2026-03-01" }, lagos, now)).toThrow(PeriodError);
    expect(() => resolveRange({ preset: "CUSTOM", from: "2020-01-01", to: "2026-01-01" }, lagos, now)).toThrow(PeriodError);
    expect(() => resolveRange({ preset: "THIS_MONTH" }, { ...lagos, timeZone: "Mars/Olympus" }, now)).toThrow(PeriodError);
  });
});

describe("buckets", () => {
  it("chooses a granularity from the length of the range", () => {
    expect(chooseGranularity({ startDate: "2026-11-01", endDate: "2026-11-30" })).toBe("day");
    expect(chooseGranularity({ startDate: "2026-10-01", endDate: "2026-12-31" })).toBe("week");
    expect(chooseGranularity({ startDate: "2026-01-01", endDate: "2026-12-31" })).toBe("month");
  });
  it("covers every bucket, including empty ones, with the facility's week start", () => {
    const starts = bucketStarts({ startDate: "2026-11-01", endDate: "2026-11-30" }, "week", 1);
    expect(starts[0]).toBe("2026-10-26");
    expect(starts.at(-1)).toBe("2026-11-30");
  });
  it("buckets an instant by local date", () => {
    expect(bucketOf(new Date("2026-10-31T23:30:00Z"), "month", lagos)).toBe("2026-11-01");
  });
});
