/**
 * Safety filter for AI output. Ported from the original Python service.
 *
 * Rules:
 *  - Patient-facing text must never contain a diagnosis, a treatment/dosage
 *    recommendation, or emergency instructions. Any hit replaces the WHOLE patient
 *    view with a safe fallback (fail closed; false positives are acceptable).
 *  - Doctor-facing text may discuss clinical content, but dosage / treatment wording
 *    and emergency advice are flagged for the reader.
 */

export const AI_DISCLAIMER =
  "This AI-generated summary is informational only and is not a medical diagnosis. Always consult a qualified healthcare professional.";

const DIAGNOSIS_PATTERNS = [
  /\byou have\s+(?:been diagnosed with\s+)?([a-z\s]+)/i,
  /\byou are\s+(?:suffering from|diagnosed with)\s+([a-z\s]+)/i,
  /\bdiagnosis\s*(?:is|:)\s+([a-z\s]+)/i,
  /\bthis\s+(?:indicates|confirms|means you have)\s+([a-z\s]+)/i,
  /\bconfirmed\s+(?:diagnosis of\s+)?([a-z\s]+)/i,
  /\b(?:the patient|this patient)\s+(?:has|is suffering from)\s+([a-z\s]+)/i,
  /\bdiagnostic impression\s*:?\s*([a-z\s]+)/i,
  /\bdifferential\s*(?:diagnosis|:)\s*([a-z\s]+)/i,
];

const TREATMENT_PATTERNS = [
  /\btake\s+(\d+)\s*mg\s+(?:of\s+)?([a-z\s]+)/i,
  /\bstart taking\s+([a-z\s]+)/i,
  /\bprescri(?:be|ption)[:\s]+([a-z\s]+)/i,
  /\bdosage\s*(?:is|:)\s+(\d+\s*mg)/i,
  /\brecommend(?:ed)?\s+(?:dose|dosage)[:\s]+(\d+)/i,
  /\bshould take\s+([a-z\s]+\d+\s*mg)/i,
  /\bstart(?:ed)?\s+(?:on\s+)?([a-z\s]+)\s+\d+\s*mg/i,
  /\btreatment\s*(?:plan|recommendation)[:\s]+([a-z\s]+)/i,
];

const EMERGENCY_PATTERNS = [
  /\bdo not\s+(?:go to|visit)\s+(?:the\s+)?hospital/i,
  /\bno need to\s+(?:go to|visit)\s+(?:the\s+)?(?:hospital|ER|emergency)/i,
  /\bdon'?t\s+(?:go to|visit)\s+(?:the\s+)?hospital/i,
  /\b(?:you (?:do not|don'?t) need|no need for)\s+(?:emergency|urgent)\s+(?:care|attention|medical)/i,
  /\bgo (?:to )?(?:the )?(?:hospital|ER|emergency room)\s+(?:immediately|right away|now)/i,
  /\bcall\s+(?:911|an ambulance|emergency services)/i,
];

const SAFE_FALLBACK: Record<string, string> = {
  en: "Only a qualified clinician can diagnose or prescribe. Please discuss these results with your doctor.",
  fr: "Seul un médecin qualifié peut poser un diagnostic ou prescrire. Veuillez discuter de ces résultats avec votre médecin.",
  es: "Solo un médico calificado puede diagnosticar o recetar. Por favor, discuta estos resultados con su médico.",
  ru: "Только квалифицированный врач может ставить диагноз и назначать лечение. Пожалуйста, обсудите эти результаты с вашим врачом.",
};

export interface SafetyFinding {
  view: "patient" | "doctor";
  snippet: string;
  reason: "DIAGNOSIS_PATTERN" | "TREATMENT_PATTERN" | "EMERGENCY_ADVICE";
}

export interface SafetyReport {
  passed: boolean;
  findings: SafetyFinding[];
  notes: string;
}

/** Collect every string anywhere inside a view (works for any view shape). */
export function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings);
  return [];
}

function scan(text: string, view: "patient" | "doctor"): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  const run = (patterns: RegExp[], reason: SafetyFinding["reason"]) => {
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) findings.push({ view, snippet: match[0].slice(0, 120), reason });
    }
  };

  run(EMERGENCY_PATTERNS, "EMERGENCY_ADVICE");
  run(TREATMENT_PATTERNS, "TREATMENT_PATTERN");
  if (view === "patient") run(DIAGNOSIS_PATTERNS, "DIAGNOSIS_PATTERN"); // doctors may see differentials
  return findings;
}

/** Check a patient-facing view. Returns the findings (empty = safe). */
export function checkPatientView(view: unknown): SafetyFinding[] {
  return scan(collectStrings(view).join(" "), "patient");
}

/** Check a doctor-facing view. Findings are flags for the reader, not rewrites. */
export function checkDoctorView(view: unknown): SafetyFinding[] {
  return scan(collectStrings(view).join(" "), "doctor");
}

export function safePatientView(language: string, title = "Your summary") {
  const fallback = SAFE_FALLBACK[language] ?? SAFE_FALLBACK.en;
  return {
    title,
    body: [fallback, "Please discuss your results with your doctor for a complete explanation."],
    next_steps: "Please discuss with your doctor.",
    disclaimer: "This summary is for your reference only. It is not a diagnosis. Please consult your doctor.",
  };
}

export function buildReport(findings: SafetyFinding[]): SafetyReport {
  return {
    passed: findings.length === 0,
    findings,
    notes: findings.length ? "Safety filters were applied to the AI output." : "No safety violations detected.",
  };
}

/** Reject clearly impossible input before it reaches the model. */
export function preLlmCheck(values: { code: string; name: string; value: number }[]): { blocked: boolean; reason?: string } {
  for (const v of values) {
    if (v.value < 0) return { blocked: true, reason: `Negative value for ${v.name}` };
    if (["WBC", "PLT", "RBC"].includes(v.code.toUpperCase()) && v.value > 10000) {
      return { blocked: true, reason: `Implausible value for ${v.name}: ${v.value}` };
    }
  }
  return { blocked: false };
}
