import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import { firstValues, optional, pageSchema, withParams } from "./params";
import { ACTION_GROUPS, describeAction } from "./audit-labels";
import { z } from "zod";

describe("toCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv([["a,b", 'say "hi"', "line\nbreak"]])).toBe('"a,b","say ""hi""","line\nbreak"\r\n');
  });
  it("neutralises spreadsheet formulas (CSV injection)", () => {
    const out = toCsv([["=HYPERLINK(\"http://evil\")", "+1", "-2", "@SUM(A1)", "normal"]]);
    expect(out).not.toMatch(/(^|,)"?=/);
    expect(out).toContain("'=HYPERLINK");
    expect(out).toContain("'+1");
    expect(out).toContain("'@SUM(A1)");
    expect(out).toContain(",normal");
  });
  it("does not alter numbers, dates, booleans or empties", () => {
    expect(toCsv([[-5, true, null, undefined, new Date("2026-01-02T03:04:05Z")]])).toBe("-5,true,,,2026-01-02T03:04:05.000Z\r\n");
  });
});

describe("filter params", () => {
  it("treats empty and 'all' as no filter, and bad pages as page 1", () => {
    const schema = z.object({ role: optional(z.enum(["A", "B"])), page: pageSchema });
    expect(schema.parse({ role: "", page: "0" })).toEqual({ role: undefined, page: 1 });
    expect(schema.parse({ role: "all", page: "x" })).toEqual({ role: undefined, page: 1 });
    expect(schema.parse({ role: "B", page: "3" })).toEqual({ role: "B", page: 3 });
  });
  it("takes the first value of repeated parameters", () => {
    expect(firstValues({ a: ["1", "2"], b: "x", c: undefined })).toEqual({ a: "1", b: "x", c: undefined });
  });
  it("keeps current filters and applies changes", () => {
    expect(withParams("/admin/users", { q: "ada", role: "DOCTOR" }, { page: "2", role: undefined })).toBe("/admin/users?q=ada&page=2");
    expect(withParams("/admin/users", {}, {})).toBe("/admin/users");
  });
});

describe("audit labels", () => {
  it("names known actions and tidies unknown ones", () => {
    expect(describeAction("ADMIN_VERIFICATION_APPROVED")).toBe("Application approved");
    expect(describeAction("SOMETHING_NEW_HAPPENED")).toBe("Something new happened");
  });
  it("covers administrator actions in the admin group", () => {
    expect(ACTION_GROUPS.admin.prefixes.some((p) => "ADMIN_REFUND".startsWith(p))).toBe(true);
  });
});
