import { describe, expect, it } from "vitest";
import { buildReportDocument, crc32, safeCell, toCsv, toPdf, toXlsx, zipStore } from "./report";
import type { DashboardPayload } from "./types";

const payload = (): DashboardPayload => ({
  dashboard: "hospital", title: "Hospital operations", facility: { id: "f", name: "Test Hospital", kind: "HOSPITAL" },
  range: { preset: "LAST_MONTH", compare: "PREVIOUS_PERIOD", likeForLike: false, timeZone: "Africa/Lagos", current: { start: "", end: "", startDate: "2026-10-01", endDate: "2026-10-31", label: "Oct 2026" }, previous: { start: "", end: "", startDate: "2026-09-01", endDate: "2026-09-30", label: "Sep 2026" } },
  kpis: [{ key: "inpatient_mortality_rate", label: "Inpatient mortality rate", value: 25, unit: "percent", betterWhen: "LOWER", numerator: 1, denominator: 4, change: { current: 25, previous: 10, delta: 15, percent: 150, direction: "UP" } }, { key: "alos", label: "=HYPERLINK(\"x\")", value: null, unit: "days", betterWhen: "LOWER" }],
  sections: [{ id: "t", title: "Trend", question: "q", visual: { type: "line", unit: "count", series: [{ name: "A", points: [{ x: "2026-10-01", y: 1 }, { x: "2026-10-02", y: null }] }] } }],
  gaps: [{ indicator: "Theatre", reason: "not recorded" }], computedAt: "2026-11-24T10:00:00.000Z", cached: false, departmentScoped: false,
});

describe("report documents", () => {
  const doc = buildReportDocument(payload(), "Whole facility");
  it("states period, comparison, scope, definitions and gaps", () => {
    expect(doc.period.label).toBe("Oct 2026");
    expect(doc.comparison?.startDate).toBe("2026-09-01");
    expect(doc.definitions.map((d) => d.name)).toContain("Inpatient mortality rate");
    expect(doc.gaps).toHaveLength(1);
  });
  it("exports rates with numerator and denominator", () => {
    const csv = toCsv(doc);
    expect(csv).toContain("Inpatient mortality rate,25,percent,1,4,10,15,150");
    expect(csv).toContain("Reporting period");
    expect(csv).toContain("Calculation definitions");
  });
  it("neutralises spreadsheet formula injection", () => {
    expect(safeCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(safeCell("+1 555")).toBe("'+1 555");
    expect(safeCell("-5")).toBe("-5");
    expect(toCsv(doc)).not.toMatch(/(^|,)=HYPERLINK/m);
  });
  it("leaves missing values empty, not zero", () => expect(toCsv(doc)).toContain("'=HYPERLINK(\"\"x\"\")\",,days"));
});

describe("binary exports", () => {
  it("computes the standard CRC-32", () => expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926));
  it("writes a readable zip", () => {
    const z = zipStore([{ name: "a.txt", data: new TextEncoder().encode("hello") }]);
    expect(String.fromCharCode(z[0], z[1], z[2], z[3])).toBe("PK\u0003\u0004");
  });
  it("builds an xlsx and a pdf", async () => {
    const doc = buildReportDocument(payload(), "Whole facility");
    expect(toXlsx(doc).length).toBeGreaterThan(500);
    const pdf = await toPdf(doc);
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
