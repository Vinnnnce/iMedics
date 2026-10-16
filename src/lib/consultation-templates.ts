/** Scaffolds only: no invented findings, diagnoses, or treatment. */
export const CONSULTATION_TEMPLATES = {
  general: { label: "General consultation", history: "Patient-reported history:\nOnset and course:\nRelevant positives and negatives:\n", examination: "Examination performed:\nFindings actually observed:\n", notes: "Patient priorities:\nQuestions discussed:\nAgreed next steps:\n" },
  followup: { label: "Follow-up review", history: "Interval history:\nPatient-reported response:\nAdherence and concerns:\n", examination: "Examination at this visit:\nObserved changes:\n", notes: "Prior plan reviewed:\nOutstanding investigations:\nNext review agreed:\n" },
  result: { label: "Result review", history: "Reason for investigation:\nCurrent symptoms:\n", examination: "Examination performed, if applicable:\n", notes: "Verified results reviewed:\nClinical context and limitations:\nExplanation and shared decisions:\n" },
} as const;
