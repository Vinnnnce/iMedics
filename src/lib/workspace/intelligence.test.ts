import { describe, expect, it } from "vitest";
import { attendanceSignals, buildTrends, careGaps, csvCell, experimentVariant, scheduleSuggestions } from "./intelligence";
import { wearableImportSchema } from "./validation";
import { demoWorkspace } from "./demo";
describe("additive workspace intelligence", () => {
  it("keeps preview unread counts consistent and excludes clinical data from admin fixtures", () => {
    for (const role of ["PATIENT", "DOCTOR"] as const) {
      const data = demoWorkspace(role);
      expect(data.unreadMessages).toBe(data.messages.filter(m => m.status === "Unread").length);
      expect(Number(data.metrics[2].value)).toBe(data.unreadMessages);
    }
    const admin = demoWorkspace("ADMIN");
    expect(admin.results).toEqual([]); expect(admin.messages).toEqual([]);
  });
  it("separates different result units and drops non-numeric results", () => {
    const rows = [
      { code: "glucose", name: "Glucose", unit: "mmol/L", value: 5.1, date: "2026-01-01" },
      { code: "glucose", name: "Glucose", unit: "mmol/L", value: 5.3, date: "2026-02-01" },
      { code: "glucose", name: "Glucose", unit: "mg/dL", value: 96, date: "2026-01-01" },
      { code: "bad", name: "Invalid", unit: "", value: NaN, date: "2026-01-01" },
    ];
    const trends = buildTrends(rows);
    expect(trends).toHaveLength(1); expect(trends[0].unit).toBe("mmol/L");
    expect(trends[0].points.map(p => p.value)).toEqual([5.1, 5.3]);
  });
  it("sorts results chronologically", () => {
    expect(buildTrends([{ code:"x", name:"X", unit:null,value:2,date:"2026-02-01" },{ code:"x",name:"X",unit:null,value:1,date:"2026-01-01" }])[0].points[0].value).toBe(1);
  });
  it("does not invent care gaps", () => {
    expect(careGaps({ intakeComplete: true, overdueFollowUps: 0, pendingReviews: 0 })).toEqual([]);
    expect(careGaps({ intakeComplete: false, overdueFollowUps: 2, pendingReviews: 1 })).toHaveLength(3);
  });
  it("labels attendance signals without a medical risk probability", () => {
    expect(attendanceSignals({ previousNoShows: 1, bookedDaysAhead: 30, confirmed: false }).level).toBe("Review");
    expect(attendanceSignals({ previousNoShows: 0, bookedDaysAhead: 2, confirmed: true }).level).toBe("Routine");
    expect(attendanceSignals({ previousNoShows: 0, bookedDaysAhead: 2, confirmed: false }).disclaimer).toContain("Never");
  });
  it("assigns deterministic A/B variants", () => {
    expect(experimentVariant("user-a", "homepage-cta")).toBe(experimentVariant("user-a", "homepage-cta"));
    expect(new Set(Array.from({ length: 100 }, (_, i) => experimentVariant(`u-${i}`, "dashboard"))).size).toBe(2);
  });
  it("suggests only same-day gaps of at least 30 minutes without double booking", () => {
    expect(scheduleSuggestions([{ at: "2026-10-15T09:00:00Z", durationMinutes: 30 }, { at: "2026-10-15T10:30:00Z", durationMinutes: 30 }])[0].minutes).toBe(60);
    expect(scheduleSuggestions([{ at: "2026-10-15T09:00:00Z", durationMinutes: 30 }, { at: "2026-10-16T09:00:00Z", durationMinutes: 30 }])).toEqual([]);
    expect(scheduleSuggestions([{ at: "2026-10-15T09:00:00Z", durationMinutes: 60 }, { at: "2026-10-15T09:30:00Z", durationMinutes: 30 }])).toEqual([]);
  });
  it("requires consent and bounded metrics for wearable imports", () => {
    const reading = { metric: "sleep_hours", value: 25, recordedAt: "2026-10-15T10:00:00Z" };
    expect(wearableImportSchema.safeParse({ consent: true, source: "QA", readings: [reading] }).success).toBe(false);
    expect(wearableImportSchema.safeParse({ consent: false, source: "QA", readings: [{ ...reading, value: 8 }] }).success).toBe(false);
    expect(wearableImportSchema.safeParse({ consent: true, source: "QA", readings: [{ ...reading, value: 8 }] }).success).toBe(true);
  });
  it.each(["=HYPERLINK(1)", "+SUM(A1)", "-2+1", "@SUM(A1)", "\t=1+1"])("neutralizes spreadsheet formula %s", input => {
    expect(csvCell(input).startsWith("\"'")).toBe(true);
  });
  it("quotes CSV double quotes and newlines", () => {
    expect(csvCell('safe "text"\nnext')).toBe('"safe ""text""\nnext"');
  });
});
