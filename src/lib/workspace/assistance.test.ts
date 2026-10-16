import { describe, expect, it } from "vitest";
import { assistanceRequestSchema, assistanceOutputSchema, localAssistance, minimizePrompt } from "./assistance";
const context = { concern: "Recorded symptom", allergies: ["Example allergy"], medications: [], pastHistory: null, diagnoses: [], verifiedResults: ["CBC (2026-10-16)"] };
describe("safe documentation assistance", () => {
  it("requires explicit consent and rejects unsupported modes", () => {
    expect(assistanceRequestSchema.safeParse({ mode: "summary", consent: false }).success).toBe(false);
    expect(assistanceRequestSchema.safeParse({ mode: "diagnose", consent: true }).success).toBe(false);
  });
  it("does not opt in to an external provider by default", () => {
    expect(assistanceRequestSchema.parse({ mode: "summary", consent: true }).useProvider).toBe(false);
  });
  it("clearly distinguishes extraction from AI-generated content", () => {
    const draft = localAssistance("summary", context);
    expect(draft.text).toContain("Not AI-generated");
    expect(draft.text).toContain("Example allergy");
    expect(draft.text).toContain("Not documented; confirm with patient.");
  });
  it("leaves examination and clinical decisions to the clinician", () => {
    const draft = localAssistance("documentation", context);
    expect(draft.text).toContain("[complete after examination]");
    expect(draft.text).toContain("[complete after review]");
    expect(draft.text).not.toMatch(/examination normal|prescribe|you have/i);
  });
  it("returns neutral pre-visit questions rather than a diagnosis", () => {
    const draft = localAssistance("intake", context);
    expect(draft.questions.length).toBeGreaterThan(0);
    expect(draft.text).toContain("not a diagnosis");
  });
  it("minimizes common direct identifiers and bounds provider inputs", () => {
    const text = minimizePrompt("Example Patient person@example.com +234 801 234 5678 https://private.example Case123", ["Example Patient", "Case123"]);
    expect(text).not.toContain("person@example.com");
    expect(text).not.toContain("801");
    expect(text).not.toContain("private.example");
    expect(text).not.toContain("Example Patient");
    expect(text).not.toContain("Case123");
    expect(minimizePrompt("a".repeat(14000))).toHaveLength(12000);
  });
  it("bounds generated text and questions before display", () => {
    expect(assistanceOutputSchema.safeParse({ text: "a".repeat(4500) }).success).toBe(false);
    expect(assistanceOutputSchema.safeParse({ text: "Draft", questions: Array(7).fill("Question?") }).success).toBe(false);
  });
});
