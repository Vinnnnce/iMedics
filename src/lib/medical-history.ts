import type { Prisma } from "@prisma/client";
import type { MedicalHistoryFormData } from "./validations";

/** Map validated medical-history input onto database columns (used by create and update). */
export function toHistoryData(data: MedicalHistoryFormData): Omit<Prisma.MedicalHistoryUncheckedCreateInput, "patientId"> {
  const complete = data.status === "complete";
  return {
    status: complete ? "COMPLETE" : "DRAFT",
    completedAt: complete ? new Date() : null,
    chiefComplaint: data.chiefComplaint || null,
    symptoms: data.symptoms,
    medications: data.medications,
    hasWound: data.hasWound,
    woundLocation: data.woundLocation || null,
    woundType: data.woundType || null,
    woundTimeSinceInjury: data.woundTimeSinceInjury || null,
    woundCause: data.woundCause || null,
    hasDiabetes: data.hasDiabetes,
    diabetesDuration: data.diabetesDuration || null,
    diabetesType: data.diabetesType || null,
    diabetesControl: data.diabetesControl || null,
    hasStroke: data.hasStroke,
    strokeDate: data.strokeDate || null,
    strokeResidual: data.strokeResidual || null,
    hasHeartAttack: data.hasHeartAttack,
    heartAttackDate: data.heartAttackDate || null,
    heartAttackInterventions: data.heartAttackInterventions || null,
    familyHistory: data.familyHistory,
    pastHistory: data.pastHistory,
    allergies: data.allergies,
    smokingStatus: data.smokingStatus || null,
    smokingQuantity: data.smokingQuantity || null,
    alcoholUse: data.alcoholUse || null,
    physicalActivity: data.physicalActivity || null,
    sleepPattern: data.sleepPattern || null,
    pregnancies: data.pregnancies ?? null,
    deliveries: data.deliveries ?? null,
    reproductiveComplications: data.reproductiveComplications || null,
    mentalHealth: data.mentalHealth,
    immunizations: data.immunizations,
  };
}

/** API shape for a history record: lowercase status, as the UI expects. */
export function serializeHistory<T extends { status: string }>(history: T) {
  return { ...history, status: history.status.toLowerCase() };
}
