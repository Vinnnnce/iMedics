import type { AiAnalysis, Role } from "@prisma/client";

/**
 * What a viewer may see of an AI analysis.
 * Doctors see everything. Patients see only the patient-facing text, and only
 * after a doctor has approved it. Everyone else sees nothing.
 */
export function aiAnalysisForViewer(analysis: AiAnalysis | null, role: Role) {
  if (!analysis) return null;
  if (role === "DOCTOR") return analysis;
  if (role === "PATIENT" && analysis.reviewStatus === "APPROVED") {
    return {
      id: analysis.id,
      kind: analysis.kind,
      patientView: analysis.patientView,
      urgencyLevel: analysis.urgencyLevel,
      reviewedAt: analysis.reviewedAt,
    };
  }
  return null;
}
