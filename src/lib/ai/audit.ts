import { prisma } from "@/lib/prisma";

/**
 * AI governance audit trail. Every AI feature call records the acting user,
 * facility/patient references (ids only — clinical content never enters
 * logs), the provider/model, the feature and the outcome. The log is
 * reviewable by compliance officers and never contains PHI values.
 */

export type AiFeature =
  | "DOCTOR_ASSISTANT"
  | "PATIENT_ASSISTANT"
  | "NURSING_HANDOVER"
  | "PHARMACY_REVIEW"
  | "ADMIN_SUMMARY"
  | "LAB_INTERPRETATION";

export function aiProviderName(): string {
  return process.env.KIMI_API_KEY ? "kimi" : "none";
}

export function aiModelName(): string | null {
  return process.env.KIMI_MODEL ?? "kimi-k3";
}

export async function logAiUsage(input: {
  userId: string;
  feature: AiFeature;
  status: "COMPLETED" | "ERROR" | "REJECTED";
  facilityId?: string | null;
  patientId?: string | null;
  inputRefs?: string[];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        userId: input.userId,
        facilityId: input.facilityId ?? null,
        patientId: input.patientId ?? null,
        feature: input.feature,
        provider: aiProviderName(),
        model: aiModelName(),
        status: input.status,
        inputRefs: input.inputRefs ?? [],
        metadata: (input.metadata ?? {}) as object,
      },
    });
  } catch (error) {
    // Audit logging must never break the clinical flow — but failures are
    // surfaced in server logs for follow-up.
    console.error("AI usage log failed:", error);
  }
}
