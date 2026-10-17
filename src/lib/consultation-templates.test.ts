import { describe, expect, it } from "vitest";
import { CONSULTATION_TEMPLATES } from "./consultation-templates";
describe("documentation scaffolds", () => {
  it.each(Object.values(CONSULTATION_TEMPLATES))("contains no prefilled clinical decisions in $label", template => {
    expect(template.history).toContain(":");
    expect(template.examination).toContain(":");
    expect(template.notes).toContain(":");
    expect(`${template.history} ${template.examination} ${template.notes}`).not.toMatch(/prescribe|normal exam|start medication|diagnosis is/i);
  });
});
