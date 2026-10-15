import { describe, expect, it } from "vitest";
import { formatDiagnosis, normalizeCode, parseSearchQuery, rankResult } from "./search";

describe("normalizeCode", () => {
  it("ignores case, dots, spaces and dashes", () => {
    expect(normalizeCode("a00.0")).toBe("A000");
    expect(normalizeCode(" E11 .9 ")).toBe("E119");
  });
});

describe("parseSearchQuery", () => {
  it("treats code-like input as a code prefix", () => {
    expect(parseSearchQuery("I10").codePrefix).toBe("I10");
    expect(parseSearchQuery("e11.9").codePrefix).toBe("E119");
    expect(parseSearchQuery("A0").codePrefix).toBe("A0");
  });

  it("treats words as description tokens, not codes", () => {
    const parsed = parseSearchQuery("  Essential  hypertension ");
    expect(parsed.codePrefix).toBeNull();
    expect(parsed.tokens).toEqual(["essential", "hypertension"]);
  });

  it("does not mistake short words for codes", () => {
    expect(parseSearchQuery("flu").codePrefix).toBeNull();
  });
});

describe("rankResult", () => {
  const raw = "I10";
  const parsed = parseSearchQuery(raw);
  it("ranks exact code before prefix before description matches", () => {
    const exact = rankResult({ code: "I10", description: "Essential (primary) hypertension" }, parsed, raw);
    const prefix = rankResult({ code: "I10.1", description: "Other" }, parsed, raw);
    const other = rankResult({ code: "Z99", description: "Contains I10 in text" }, parsed, raw);
    expect(exact).toBeLessThan(prefix);
    expect(prefix).toBeLessThan(other);
  });
});

describe("formatDiagnosis", () => {
  it("shows code and description", () => {
    expect(formatDiagnosis({ code: "I10", description: "Essential (primary) hypertension" })).toBe(
      "I10 — Essential (primary) hypertension",
    );
  });
});
