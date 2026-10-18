import { z } from "zod";

/**
 * Validation for structured prescriptions. Every clinically meaningful field is
 * captured; the doctor's confirmation of safety alerts is required before the
 * prescription can be issued when any high-severity alert exists.
 */

export const ROUTES = ["oral", "intravenous", "intramuscular", "subcutaneous", "topical", "inhaled", "rectal", "sublingual", "ophthalmic", "otic", "nasal"] as const;
export const DOSE_UNITS = ["mg", "micrograms", "g", "mL", "units", "IU", "%"] as const;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times must use 24-hour HH:mm format");

export const prescriptionItemSchema = z.object({
  drugName: z.string().trim().min(1, "Medication name is required").max(200),
  activeIngredient: z.string().trim().max(200).optional(),
  drugClass: z.string().trim().max(120).optional(),
  pharmacologicalClass: z.string().trim().max(120).optional(),
  antibioticClass: z.string().trim().max(60).optional(),
  antimicrobialSpectrum: z.array(z.string().max(40)).max(8).default([]),
  coverageNotes: z.string().trim().max(500).optional(),
  indication: z.string().trim().max(300).optional(),
  route: z.enum(ROUTES).optional(),
  formulation: z.string().trim().max(120).optional(),
  strength: z.string().trim().max(60).optional(),
  doseValue: z.number().positive().max(100000).optional(),
  doseUnit: z.enum(DOSE_UNITS).optional(),
  frequency: z.string().trim().max(80).optional(),
  frequencyText: z.string().trim().max(200).optional(),
  schedule: z.array(time).max(8).default([]),
  duration: z.string().trim().max(80).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  quantity: z.number().int().positive().max(10000).optional(),
  refills: z.number().int().min(0).max(99).optional(),
  foodInstructions: z.string().trim().max(300).optional(),
  missedDoseInstructions: z.string().trim().max(300).optional(),
  precautions: z.string().trim().max(500).optional(),
  monitoring: z.string().trim().max(500).optional(),
  medicationRefId: z.string().uuid().optional(),
  clinicalOverrideNotes: z.string().trim().max(500).optional(),
  instructions: z.string().trim().max(1000).optional(),
});

/** The plain object schema (before the cross-field refinement). */
export const createPrescriptionObjectSchema = z.object({
  patientId: z.string().uuid(),
  consultationId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
  validUntil: z.coerce.date().optional(),
  items: z.array(prescriptionItemSchema).min(1, "Add at least one medication").max(20),
  // The prescriber must confirm they reviewed the safety information.
  safetyAcknowledged: z.boolean(),
  safetyAlerts: z.array(z.object({ code: z.string(), severity: z.enum(["HIGH", "MODERATE", "LOW", "INFO"]), message: z.string().max(500) })).default([]),
});

export const createPrescriptionSchema = createPrescriptionObjectSchema.refine(
  (p) => p.items.every((i) => i.endDate === undefined || i.startDate === undefined || i.endDate >= i.startDate),
  {
    message: "End date cannot be before the start date",
    path: ["items"],
  },
);

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>;

/** Frequency presets offered in the UI (clinician-defined intervals are free text). */
export const FREQUENCY_PRESETS = [
  { label: "Once daily (OD)", value: "1x daily" },
  { label: "Twice daily (BD)", value: "2x daily" },
  { label: "Three times daily (TDS)", value: "3x daily" },
  { label: "Four times daily (QDS)", value: "4x daily" },
  { label: "Every 6 hours", value: "every 6 hours" },
  { label: "Every 8 hours", value: "every 8 hours" },
  { label: "Every 12 hours", value: "every 12 hours" },
  { label: "As needed (PRN)", value: "PRN" },
] as const;

export const SCHEDULE_SLOTS = [
  { label: "Morning", time: "08:00" },
  { label: "Afternoon", time: "13:00" },
  { label: "Evening", time: "18:00" },
  { label: "Bedtime", time: "22:00" },
] as const;
