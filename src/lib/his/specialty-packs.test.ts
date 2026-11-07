import { describe, expect, it } from "vitest";
import { catalogue } from "./catalogue";
import { parseDefinition } from "./template-schema";

describe("specialty pack defaults", () => {
  const packs = catalogue().filter((t) => t.groupCode === "N");
  it("preserves all 18 existing source identifiers", () => {
    expect(packs).toHaveLength(18);
    expect(packs[0].code).toBe("N.01-pediatrics-and-neonatology");
    expect(packs[17].code).toBe("N.18-burns-and-wound-care");
  });
  it.each(packs.map((p) => [p.name, p] as const))("%s has a valid, independently reviewed structured assessment", (_name, pack) => {
    const def = parseDefinition(pack.definition);
    expect(def.workflow).toEqual({ requiresReview: true, independentReview: true });
    const section = def.sections.find((s) => s.id === "specialty")!;
    expect(section.fields.length).toBeGreaterThanOrEqual(6);
    expect(section.fields.filter((f) => f.required && f.locked)).toHaveLength(2);
    expect(def.notice).toContain("clinical teams");
  });
  it("specially protects mental-health and infectious-disease records", () => {
    expect(packs.find((p) => /Psychiatry/.test(p.name))!.definition.sensitivity).toBe("SPECIALLY_PROTECTED");
    expect(packs.find((p) => /Infectious/.test(p.name))!.definition.sensitivity).toBe("SPECIALLY_PROTECTED");
  });
});
