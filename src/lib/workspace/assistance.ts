import { z } from "zod";
export const assistanceRequestSchema = z.object({
  mode: z.enum(["summary", "documentation", "intake"]), patientId: z.uuid().optional(), appointmentId: z.uuid().optional(),
  consent: z.literal(true), useProvider: z.boolean().default(false), concern: z.string().trim().max(3000).default(""),
});
export const assistanceOutputSchema = z.object({ text: z.string().trim().min(1).max(4400), questions: z.array(z.string().min(1).max(300)).max(6).default([]) });
export interface AssistanceContext {
  concern: string; allergies: unknown; medications: unknown; pastHistory: unknown;
  diagnoses: string[]; verifiedResults: string[];
}
/** Remove common direct identifiers, not a claim of formal de-identification. */
export function minimizePrompt(value: string, identifiers: string[] = []) {
  let text = value.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]")
    .replace(/https?:\/\/\S+/gi, "[URL removed]")
    .replace(/\+?\d[\d ()-]{8,}\d/g, "[number removed]");
  for (const identifier of identifiers.filter(value => value.trim().length > 2)) {
    text = text.replaceAll(identifier, "[identifier removed]");
  }
  return text.slice(0, 12000);
}
export function localAssistance(mode: "summary" | "documentation" | "intake", context: AssistanceContext) {
  const show = (value: unknown) => value == null || (Array.isArray(value) && !value.length) ? "Not documented; confirm with patient." : typeof value === "string" ? value : JSON.stringify(value);
  const questions = ["What would you most like to discuss?", "When did this start and what has changed?", "What medications are you taking?", "What allergies or reactions should your clinician know about?"];
  if (mode === "intake") return { text: "Guided intake questions only. Your clinician reviews the answers; this is not a diagnosis or clinical advice.", questions };
  return { text: [
    "Local record extract. Not AI-generated. Verify every item with the patient.",
    `Recorded concern: ${context.concern || "Not documented."}`,
    `Recorded allergies: ${show(context.allergies)}`, `Recorded medications: ${show(context.medications)}`,
    `Past history: ${show(context.pastHistory)}`,
    `Prior clinician-recorded diagnoses: ${context.diagnoses.join("; ") || "Not recorded."}`,
    `Verified result panels: ${context.verifiedResults.join("; ") || "None in the loaded records."}`,
    ...(mode === "documentation" ? ["Clinician examination: [complete after examination]", "Clinician assessment: [complete after review]", "Clinician plan and shared decisions: [complete manually]"] : []),
  ].join("\n\n").slice(0, 4300) + "\n\nExtract only; review the complete source records.", questions: [] };
}
