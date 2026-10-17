import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { enforceAiRateLimit } from "@/lib/ai/rate-limit";
import { checkPatientView, safePatientView } from "@/lib/ai/safety";

const bodySchema = z.object({ action: z.enum(["analyze", "summary", "recap"]).default("analyze") });

// POST /api/patients/[id]/history/[historyId]/ai — doctor-only AI assistance.
// The result is stored as PENDING_REVIEW: nothing reaches the patient until a doctor approves it.
export const POST = withAuth<{ id: string; historyId: string }>(["DOCTOR"], async (req, { user, params }) => {
  const { id, historyId: rawHistoryId } = await params;
  const patientId = parseId(id);
  const historyId = parseId(rawHistoryId);
  await findAccessiblePatient(user, patientId);

  const { action } = bodySchema.parse(await req.json().catch(() => ({})));
  await enforceAiRateLimit(user.id);

  const history = await prisma.medicalHistory.findFirst({ where: { id: historyId, patientId } });
  if (!history) throw notFound("Medical history not found");

  const analysis = generateAnalysis(history, action) as Prisma.InputJsonValue;
  // Patient-facing recaps go through the same safety filter as every other AI output.
  const patientView = action === "recap" ? (checkPatientView(analysis).length ? safePatientView("en") : analysis) : undefined;

  const fields = {
    status: "COMPLETED" as const,
    reviewStatus: "PENDING_REVIEW" as const,
    reviewedById: null,
    reviewedAt: null,
    doctorView: analysis,
    ...(patientView ? { patientView: patientView as Prisma.InputJsonValue } : {}),
    model: "rule-based",
  };
  const saved = await prisma.aiAnalysis.upsert({
    where: { medicalHistoryId: historyId },
    create: { kind: "MEDICAL_HISTORY", medicalHistoryId: historyId, ...fields },
    update: fields,
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "AI_ANALYSIS_REQUESTED",
    resourceType: "MedicalHistory",
    resourceId: historyId,
    details: { action },
    req,
  });

  return NextResponse.json({
    historyId,
    action,
    analysis,
    reviewStatus: saved.reviewStatus,
    disclaimer:
      "AI output is assistive only. Not a diagnosis. All AI outputs must be clinician-reviewed before clinical use.",
  });
});

interface HistoryData {
  chiefComplaint: string | null;
  symptoms: unknown;
  medications: unknown;
  hasWound: boolean;
  woundLocation: string | null;
  woundType: string | null;
  woundCause: string | null;
  hasDiabetes: boolean;
  hasStroke: boolean;
  hasHeartAttack: boolean;
  familyHistory: unknown;
  pastHistory: unknown;
  allergies: unknown;
  smokingStatus: string | null;
  alcoholUse: string | null;
  physicalActivity: string | null;
  sleepPattern: string | null;
  mentalHealth: unknown;
  immunizations: unknown;
}

interface SymptomItem {
  name?: string;
  severity?: number | string | null;
  duration?: string;
  onset?: string;
}

interface MedicationItem {
  name?: string;
  dose?: string;
  frequency?: string;
}

function generateAnalysis(history: HistoryData, action: string) {
  const symptoms = (history.symptoms as SymptomItem[]) || [];
  const medications = (history.medications as MedicationItem[]) || [];
  const familyHistory = (history.familyHistory as unknown[]) || [];
  const pastHistory = (history.pastHistory as unknown[]) || [];
  const allergies = (history.allergies as unknown[]) || [];
  const mentalHealth = (history.mentalHealth as unknown[]) || [];

  const riskFactors: string[] = [];
  const suggestedQuestions: string[] = [];
  const symptomClusters: Record<string, string[]> = {};

  // Identify risk factors
  if (history.smokingStatus && history.smokingStatus !== "never") {
    riskFactors.push(`Smoking (${history.smokingStatus})`);
  }
  if (history.alcoholUse && history.alcoholUse !== "none") {
    riskFactors.push(`Alcohol use (${history.alcoholUse})`);
  }
  if (history.hasDiabetes) riskFactors.push("Diabetes");
  if (history.hasStroke) riskFactors.push("History of stroke");
  if (history.hasHeartAttack) riskFactors.push("History of heart attack");
  if (history.physicalActivity === "sedentary") {
    riskFactors.push("Sedentary lifestyle");
  }

  // Generate suggested questions based on chief complaint
  const complaint = history.chiefComplaint?.toLowerCase() || "";
  if (complaint.includes("pain")) {
    suggestedQuestions.push(
      "Can you describe the pain character (sharp, dull, throbbing)?",
      "What makes the pain better or worse?",
      "How would you rate the pain on a scale of 0-10?"
    );
  }
  if (complaint.includes("fever")) {
    suggestedQuestions.push(
      "How long has the fever been present?",
      "Have you measured the temperature? What was it?",
      "Are there any associated symptoms like chills or sweating?"
    );
  }
  if (complaint.includes("cough")) {
    suggestedQuestions.push(
      "How long have you had the cough?",
      "Is the cough dry or productive?",
      "Have you noticed any blood in the sputum?"
    );
  }
  if (complaint.includes("chest")) {
    suggestedQuestions.push(
      "Does the pain radiate to your arm or jaw?",
      "Is the pain associated with exertion?",
      "Do you have any shortness of breath?"
    );
  }
  // Generic questions
  if (suggestedQuestions.length === 0) {
    suggestedQuestions.push(
      "When did the symptoms first start?",
      "How have the symptoms progressed over time?",
      "What treatments have you tried so far?"
    );
  }

  // Cluster symptoms by body system
  const systemMap: Record<string, string[]> = {
    "Respiratory": ["cough", "shortness of breath", "wheezing", "sputum"],
    "Cardiovascular": ["chest pain", "palpitations", "edema", "syncope"],
    "Gastrointestinal": ["nausea", "vomiting", "diarrhea", "abdominal pain", "constipation"],
    "Neurological": ["headache", "dizziness", "numbness", "weakness", "confusion"],
    "Musculoskeletal": ["joint pain", "back pain", "muscle pain", "stiffness"],
    "Dermatological": ["rash", "itching", "skin lesion"],
  };

  for (const [system, keywords] of Object.entries(systemMap)) {
    const matched = symptoms.filter((s) => {
      const name = (s.name || "").toLowerCase();
      return keywords.some((k) => name.includes(k));
    });
    if (matched.length > 0) {
      symptomClusters[system] = matched.map((s) => s.name ?? "");
    }
  }
  // Any unclassified symptoms go to "Other"
  const classified = new Set(
    Object.values(symptomClusters).flat().map((s) => s.toLowerCase())
  );
  const other = symptoms.filter(
    (s) => !classified.has((s.name || "").toLowerCase())
  );
  if (other.length > 0) {
    symptomClusters["Other"] = other.map((s) => s.name ?? "");
  }

  if (action === "summary") {
    // Generate structured HPI
    const summary = generateHPI(history, symptoms, medications, riskFactors);
    return {
      type: "summary",
      hpi: summary,
      riskFactors,
      suggestedQuestions,
      symptomClusters,
    };
  }

  if (action === "recap") {
    // Generate patient-friendly explanation
    const recap = generatePatientRecap(history, symptoms);
    return {
      type: "recap",
      recap,
      riskFactors,
    };
  }

  // Default: full analysis
  return {
    type: "analysis",
    suggestedQuestions,
    riskFactors,
    symptomClusters,
    summary: generateHPI(history, symptoms, medications, riskFactors),
    alleryCount: allergies.length,
    medicationCount: medications.length,
    familyHistoryCount: familyHistory.length,
    pastHistoryCount: pastHistory.length,
    mentalHealthCount: mentalHealth.length,
  };
}

function generateHPI(
  history: HistoryData,
  symptoms: SymptomItem[],
  medications: MedicationItem[],
  riskFactors: string[]
): string {
  const parts: string[] = [];

  if (history.chiefComplaint) {
    parts.push(`Chief Complaint: ${history.chiefComplaint}`);
  }

  if (symptoms.length > 0) {
    const symptomTexts = symptoms.map((s) => {
      const parts = [s.name ?? ""];
      if (s.severity != null) parts.push(`severity ${s.severity}/10`);
      if (s.duration) parts.push(`duration ${s.duration}`);
      if (s.onset) parts.push(`onset ${s.onset}`);
      return parts.join(", ");
    });
    parts.push(`Symptoms: ${symptomTexts.join("; ")}`);
  }

  if (history.hasWound) {
    const woundParts = [];
    if (history.woundLocation) woundParts.push(`location: ${history.woundLocation}`);
    if (history.woundType) woundParts.push(`type: ${history.woundType}`);
    if (history.woundCause) woundParts.push(`cause: ${history.woundCause}`);
    parts.push(`Wound/Injury: ${woundParts.join(", ")}`);
  }

  if (medications.length > 0) {
    const medTexts = medications.map((m) =>
      `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? ` ${m.frequency}` : ""}`
    );
    parts.push(`Current Medications: ${medTexts.join("; ")}`);
  }

  if (history.hasDiabetes) parts.push("Chronic Conditions: Diabetes");
  if (history.hasStroke) parts.push("History of Stroke");
  if (history.hasHeartAttack) parts.push("History of Heart Attack");

  if (riskFactors.length > 0) {
    parts.push(`Risk Factors: ${riskFactors.join(", ")}`);
  }

  return parts.join("\n\n");
}

function generatePatientRecap(history: HistoryData, symptoms: SymptomItem[]): string {
  const parts: string[] = [];

  if (history.chiefComplaint) {
    parts.push(
      `You visited the clinic today because of: ${history.chiefComplaint}.`
    );
  }

  if (symptoms.length > 0) {
    const symptomNames = symptoms.map((s) => s.name).join(", ");
    parts.push(
      `You reported the following symptoms: ${symptomNames}. Your doctor will review these carefully.`
    );
  }

  if (history.hasDiabetes) {
    parts.push(
      "Your medical history includes diabetes. It's important to monitor your blood sugar levels regularly."
    );
  }

  if (history.hasStroke) {
    parts.push(
      "You have a history of stroke. Please follow your doctor's recommendations for prevention of recurrence."
    );
  }

  if (history.hasHeartAttack) {
    parts.push(
      "You have a history of heart problems. Please continue taking any prescribed medications and follow up with your cardiologist."
    );
  }

  parts.push(
    "Remember: This is a summary of what you discussed with your doctor. If you have any questions or concerns, please don't hesitate to contact your healthcare provider."
  );

  return parts.join(" ");
}
