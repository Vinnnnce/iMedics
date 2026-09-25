import { z } from "zod";

// ── Patient Registration Schema ────────────────────────

export const patientSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  middleName: z.string().max(100).optional(),
  caseNumber: z.string().min(1, "Case number is required"),
  gender: z.enum(["male", "female", "other"], {
    message: "Please select a gender",
  }),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  height: z
    .number()
    .min(30, "Height must be at least 30cm")
    .max(300, "Height must be at most 300cm")
    .optional()
    .nullable(),
  weight: z
    .number()
    .min(1, "Weight must be at least 1kg")
    .max(500, "Weight must be at most 500kg")
    .optional()
    .nullable(),
  occupation: z.string().max(200).optional(),
  addressLine1: z.string().max(500).optional(),
  addressLine2: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(10).optional(),
  // Emergency contact
  ecName: z.string().max(200).optional(),
  ecRelationship: z.string().max(100).optional(),
  ecPhone: z.string().max(50).optional(),
  ecAddress: z.string().max(500).optional(),
});

export type PatientFormData = z.infer<typeof patientSchema>;

// ── Medical History Schemas ────────────────────────────

export const symptomSchema = z.object({
  name: z.string().min(1, "Symptom name is required"),
  onset: z.string().optional(),
  worseningTime: z.string().optional(),
  reliefTime: z.string().optional(),
  character: z.string().optional(),
  severity: z
    .number()
    .min(0, "Severity must be 0-10")
    .max(10, "Severity must be 0-10")
    .optional()
    .nullable(),
  duration: z.string().optional(),
  notes: z.string().optional(),
});

export const medicationSchema = z.object({
  name: z.string().min(1, "Medication name is required"),
  dose: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  status: z.enum(["current", "recent"]).optional(),
});

export const familyHistoryItemSchema = z.object({
  condition: z.string().min(1, "Condition is required"),
  relationship: z.string().optional(),
  ageAtOnset: z.string().optional(),
});

export const pastHistoryItemSchema = z.object({
  diagnosis: z.string().min(1, "Diagnosis/surgery is required"),
  date: z.string().optional(),
  outcome: z.string().optional(),
});

export const allergySchema = z.object({
  type: z.string().min(1, "Allergy type is required"),
  allergen: z.string().min(1, "Allergen is required"),
  reactionType: z.string().optional(),
  severity: z.enum(["mild", "moderate", "severe"]).optional(),
});

export const mentalHealthItemSchema = z.object({
  condition: z.string().min(1, "Condition is required"),
  duration: z.string().optional(),
  treatment: z.string().optional(),
});

export const immunizationSchema = z.object({
  vaccine: z.string().min(1, "Vaccine name is required"),
  date: z.string().optional(),
  status: z.enum(["completed", "scheduled", "refused"]).optional(),
});

export const medicalHistorySchema = z.object({
  // A. Chief Complaint
  chiefComplaint: z.string().optional(),
  // B. Symptoms
  symptoms: z.array(symptomSchema),
  // C. Medications
  medications: z.array(medicationSchema),
  // D. Wound/Injury
  hasWound: z.boolean(),
  woundLocation: z.string().optional(),
  woundType: z.string().optional(),
  woundTimeSinceInjury: z.string().optional(),
  woundCause: z.string().optional(),
  // E. Chronic Conditions
  hasDiabetes: z.boolean(),
  diabetesDuration: z.string().optional(),
  diabetesType: z.string().optional(),
  diabetesControl: z.string().optional(),
  hasStroke: z.boolean(),
  strokeDate: z.string().optional(),
  strokeResidual: z.string().optional(),
  hasHeartAttack: z.boolean(),
  heartAttackDate: z.string().optional(),
  heartAttackInterventions: z.string().optional(),
  // F. Family History
  familyHistory: z.array(familyHistoryItemSchema),
  // G. Past History
  pastHistory: z.array(pastHistoryItemSchema),
  // H. Allergies
  allergies: z.array(allergySchema),
  // I. Lifestyle
  smokingStatus: z.string().optional(),
  smokingQuantity: z.string().optional(),
  alcoholUse: z.string().optional(),
  physicalActivity: z.string().optional(),
  sleepPattern: z.string().optional(),
  // J. Reproductive History
  pregnancies: z.number().int().optional().nullable(),
  deliveries: z.number().int().optional().nullable(),
  reproductiveComplications: z.string().optional(),
  // K. Mental Health
  mentalHealth: z.array(mentalHealthItemSchema),
  // L. Immunizations
  immunizations: z.array(immunizationSchema),
  // Status
  status: z.enum(["draft", "complete"]),
});

export type MedicalHistoryFormData = z.infer<typeof medicalHistorySchema>;
