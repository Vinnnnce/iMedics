import { describe, expect, it } from "vitest";
import { dashboardFilterSchema, filterWorkspaceItems } from "./filters";
const rows = [
  { id: "1", title: "Consultation", subtitle: "Reviewed", status: "Complete", at: "2026-10-16T23:30:00Z", caseNumber: "IM-10" },
  { id: "2", title: "Result", subtitle: "Pending", status: "Pending", at: "2026-10-15T12:00:00Z" },
  { id: "3", title: "Unscheduled task", subtitle: "", status: "Pending" },
];
describe("dashboard filters", () => {
  it("searches authorized case numbers and handles case-insensitive labels", () => {
    expect(filterWorkspaceItems(rows, { search: "im-10", status: "all", from: "", to: "" }).map(row => row.id)).toEqual(["1"]);
  });
  it("uses inclusive UTC date boundaries and excludes undated records", () => {
    expect(filterWorkspaceItems(rows, { search: "", status: "all", from: "2026-10-16", to: "2026-10-16" }).map(row => row.id)).toEqual(["1"]);
  });
  it("combines status and search rather than broadening the dataset", () => {
    expect(filterWorkspaceItems(rows, { search: "Result", status: "Complete", from: "", to: "" })).toEqual([]);
  });
  it.each([{ from: "2026-02-30" }, { from: "2026-10-17", to: "2026-10-16" }])("rejects invalid or inverted date ranges", value => {
    expect(dashboardFilterSchema.safeParse(value).success).toBe(false);
  });
});
