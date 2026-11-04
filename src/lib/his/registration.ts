/**
 * Advanced patient registration & admission workspace — shared domain logic.
 *
 * Contains the registration payload schema, the duplicate-detection scoring
 * used before a new patient record may be created, the admission document
 * template, and consent acknowledgement templates.
 *
 * Design rules (per facility policy encoded here):
 * - New patients are only created after potential duplicates were shown to
 *   staff and explicitly acknowledged (`acknowledgedDuplicateIds`).
 * - Duplicate detection is deliberately conservative: similar names alone are
 *   a "possible" match requiring human review, never an automatic merge.
 * - Consents are versioned, status-tracked and auditable; a single generic
 *   checkbox is never treated as sufficient.
 */
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";

/* ------------------------------------------------------------------ */
/* Registration payload schema                                         */
/* ------------------------------------------------------------------ */

export const ADMISSION_TYPES = [
  { value: "OUTPATIENT", label: "Outpatient registration", encounterType: "UNSCHEDULED_OUTPATIENT", inpatient: false },
  { value: "SCHEDULED_OUTPATIENT", label: "Scheduled outpatient", encounterType: "SCHEDULED_OUTPATIENT", inpatient: false },
  { value: "INPATIENT_PLANNED", label: "Planned admission", encounterType: "PLANNED_INPATIENT", inpatient: true },
  { value: "INPATIENT_EMERGENCY", label: "Emergency admission", encounterType: "EMERGENCY_INPATIENT", inpatient: true },
  { value: "DAY_CARE", label: "Day-care admission", encounterType: "DAY_SURGERY", inpatient: false },
  { value: "OBSERVATION", label: "Observation admission", encounterType: "OBSERVATION", inpatient: false },
  { value: "EMERGENCY_DEPARTMENT", label: "Emergency department", encounterType: "EMERGENCY_DEPARTMENT", inpatient: false },
  { value: "REFERRAL", label: "Referral-based admission", encounterType: "TRANSFER_IN", inpatient: true },
  { value: "FOLLOW_UP", label: "Follow-up visit", encounterType: "FOLLOW_UP", inpatient: false },
] as const;
export type AdmissionTypeValue = (typeof ADMISSION_TYPES)[number]["value"];
export function admissionTypeConfig(value: string) {
  return ADMISSION_TYPES.find((t) => t.value === value) ?? ADMISSION_TYPES[0];
}

export const PAYER_CATEGORIES = [
  "SELF_PAY",
  "PUBLIC_INSURANCE",
  "PRIVATE_INSURANCE",
  "EMPLOYER_SPONSORED",
  "GOVERNMENT_SUBSIDIZED",
  "INTERNATIONAL_INSURANCE",
  "TRAVEL_INSURANCE",
  "UNINSURED",
  "CHARITY",
  "OTHER",
] as const;

export const contactMethodSchema = z.enum(["PHONE", "EMAIL", "SMS", "MAIL", "OTHER"]);

export const emergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(160),
  relationship: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  altPhone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(400).optional(),
});

export const guardianSchema = z.object({
  name: z.string().trim().min(1).max(160),
  relationship: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  authority: z.string().trim().max(200).optional(),
});

export const vitalsSchema = z.object({
  systolic: z.coerce.number().min(40).max(300).optional(),
  diastolic: z.coerce.number().min(20).max(200).optional(),
  heartRate: z.coerce.number().min(20).max(300).optional(),
  respiratoryRate: z.coerce.number().min(4).max(80).optional(),
  temperatureC: z.coerce.number().min(30).max(45).optional(),
  spo2: z.coerce.number().min(50).max(100).optional(),
  weightKg: z.coerce.number().min(0.5).max(500).optional(),
  heightCm: z.coerce.number().min(20).max(260).optional(),
  glucoseMmolL: z.coerce.number().min(0.1).max(60).optional(),
  painScore: z.coerce.number().min(0).max(10).optional(),
  notes: z.string().trim().max(400).optional(),
});
export type VitalsInput = z.infer<typeof vitalsSchema>;

export const clinicalAssessmentSchema = z.object({
  presentingComplaint: z.string().trim().max(400).optional(),
  historyOfComplaint: z.string().trim().max(2000).optional(),
  durationOfSymptoms: z.string().trim().max(80).optional(),
  examinationFindings: z.string().trim().max(2000).optional(),
  provisionalDiagnosis: z.string().trim().max(400).optional(),
  relevantConditions: z.string().trim().max(1000).optional(),
  initialTreatment: z.string().trim().max(1000).optional(),
  vitals: vitalsSchema.optional(),
});

export const coverageSchema = z.object({
  category: z.enum(PAYER_CATEGORIES),
  providerName: z.string().trim().max(160).optional(),
  planName: z.string().trim().max(160).optional(),
  memberNumber: z.string().trim().max(80).optional(),
  policyNumber: z.string().trim().max(80).optional(),
  principalMemberName: z.string().trim().max(160).optional(),
  dependentRelationship: z.string().trim().max(80).optional(),
  coverageStart: z.string().date().optional(),
  coverageEnd: z.string().date().optional(),
  authorizationNumber: z.string().trim().max(80).optional(),
  preauthRequired: z.boolean().optional(),
  copayKobo: z.coerce.number().int().min(0).optional(),
  outOfPocketKobo: z.coerce.number().int().min(0).optional(),
  benefitNotes: z.string().trim().max(1000).optional(),
});

export const consentItemSchema = z.object({
  key: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(20),
  status: z.enum(["GIVEN", "REFUSED", "NOT_APPLICABLE", "DEFERRED"]),
  signedByRole: z.enum(["PATIENT", "GUARDIAN", "REPRESENTATIVE"]).default("PATIENT"),
  capturedByName: z.string().trim().max(160).optional(),
  capturedAt: z.string().datetime().optional(),
  withdrawnAt: z.string().datetime().optional(),
});
export type ConsentItem = z.infer<typeof consentItemSchema>;

/**
 * Facility-configurable consent catalogue. Consent documents must be reviewed
 * by qualified legal/clinical personnel before being enforced; the versions
 * below are editable in the registration settings payload and are stored with
 * every acknowledgement so the exact version shown is traceable.
 */
export const CONSENT_CATALOGUE = [
  { key: "general_admission", title: "General admission consent", version: "1.0", required: true },
  { key: "treatment", title: "Consent to medical treatment", version: "1.0", required: false },
  { key: "privacy_notice", title: "Privacy & data-processing notice", version: "1.0", required: true },
  { key: "information_sharing", title: "Consent to information sharing", version: "1.0", required: false },
  { key: "financial_responsibility", title: "Acknowledgement of financial responsibility", version: "1.0", required: true },
  { key: "facility_policies", title: "Acknowledgement of facility policies", version: "1.0", required: false },
] as const;

export const newPatientSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional(),
  preferredName: z.string().trim().max(80).optional(),
  dateOfBirth: z.string().date(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  maritalStatus: z.string().trim().max(30).optional(),
  nationality: z.string().trim().max(80).optional(),
  preferredLanguage: z.string().trim().max(60).optional(),
  occupation: z.string().trim().max(120).optional(),
  identityNumber: z.string().trim().max(60).optional(),
  identityVerified: z.boolean().default(false),
  phone: z.string().trim().max(40).optional(),
  altPhone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(160).optional(),
  preferredContactMethod: contactMethodSchema.optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  emergencyContacts: z.array(emergencyContactSchema).max(5).default([]),
  guardian: guardianSchema.optional(),
});
export type NewPatientInput = z.infer<typeof newPatientSchema>;

export const registrationSchema = z.object({
  draftId: z.string().uuid().optional(),
  admissionType: z.enum(ADMISSION_TYPES.map((t) => t.value) as [AdmissionTypeValue, ...AdmissionTypeValue[]]),
  /** Existing patients must be matched by case number + DOB (exact). */
  patient: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("EXISTING"),
      caseNumber: z.string().trim().min(3),
      dateOfBirth: z.string().date(),
    }),
    z.object({
      mode: z.literal("NEW"),
      data: newPatientSchema,
      /** Reviewed possible matches, confirmed by staff to be different people. */
      acknowledgedDuplicateIds: z.array(z.string().uuid()).default([]),
    }),
    z.object({
      mode: z.literal("TEMPORARY"),
      temporaryLabel: z.string().trim().min(1).max(80),
    }),
  ]),
  emergency: z.boolean().default(false),
  arrivalMode: z.string().trim().max(40).optional(),
  referralSource: z.string().trim().max(160).optional(),
  department: z.string().trim().max(120).optional(),
  clinicianName: z.string().trim().max(160).optional(),
  responsibleConsultant: z.string().trim().max(160).optional(),
  admittingDoctorId: z.string().uuid().optional(),
  wardId: z.string().uuid().optional(),
  bedId: z.string().uuid().optional(),
  reasonForAdmission: z.string().trim().max(1000).optional(),
  expectedDischarge: z.string().date().optional(),
  isolationRequirements: z.string().trim().max(200).optional(),
  specialCareNotes: z.string().trim().max(500).optional(),
  assessment: clinicalAssessmentSchema.optional(),
  knownAllergies: z.string().trim().max(1000).optional(),
  coverage: coverageSchema.optional(),
  consents: z.array(consentItemSchema).default([]),
});
export type RegistrationInput = z.infer<typeof registrationSchema>;

/* ------------------------------------------------------------------ */
/* Duplicate detection                                                 */
/* ------------------------------------------------------------------ */

export interface DuplicateMatch {
  id: string;
  caseNumber: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gender: string;
  dateOfBirth: string;
  phone: string | null;
  email: string | null;
  unidentified: boolean;
  score: number;
  reasons: string[];
}

/** Normalise a name/phone for comparison (case/diacritic-insensitive-ish). */
function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Jaccard similarity over name tokens, weighted to first+last overlap. */
function nameSimilarity(aFirst: string, aLast: string, bFirst: string, bLast: string): number {
  const a = new Set([...normalise(aFirst).split(" "), ...normalise(aLast).split(" ")].filter(Boolean));
  const b = new Set([...normalise(bFirst).split(" "), ...normalise(bLast).split(" ")].filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * Score one candidate against the new-patient data. Returns 0..1 plus the
 * human-readable reasons for the review screen. Exact DOB + strong name
 * overlap is a high-confidence possible duplicate; identical phone, email,
 * identity or insurance numbers add independent confirmation.
 */
export function scoreDuplicate(data: NewPatientInput, candidate: {
  id: string;
  caseNumber: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gender: string;
  dateOfBirth: Date;
  phone: string | null;
  email: string | null;
  identityNumber: string | null;
  insuranceNumber: string | null;
  unidentified: boolean;
}): DuplicateMatch {
  const reasons: string[] = [];
  const dobSame = candidate.dateOfBirth.toISOString().slice(0, 10) === data.dateOfBirth;
  const nameSim = nameSimilarity(data.firstName, data.lastName, candidate.firstName, candidate.lastName);
  const dobYearSame = candidate.dateOfBirth.getUTCFullYear() === Number(data.dateOfBirth.slice(0, 4));

  let score = 0;
  if (dobSame) {
    score += 0.3;
    reasons.push("Same date of birth");
  } else if (dobYearSame) {
    score += 0.08;
    reasons.push("Same year of birth");
  }
  if (nameSim >= 0.34) {
    score += 0.3 * nameSim + (nameSim >= 0.6 ? 0.15 : 0);
    reasons.push(nameSim >= 0.6 ? "Very similar name" : "Similar name");
  }
  if (data.phone && candidate.phone && normalise(data.phone) === normalise(candidate.phone)) {
    score += 0.35;
    reasons.push("Same phone number");
  }
  if (data.email && candidate.email && data.email.toLowerCase() === candidate.email.toLowerCase()) {
    score += 0.35;
    reasons.push("Same email address");
  }
  if (data.identityNumber && candidate.identityNumber && data.identityNumber === candidate.identityNumber) {
    score += 0.6;
    reasons.push("Same identity number");
  }
  if (data.gender && candidate.gender === data.gender) {
    score += 0.02;
  }
  if (candidate.unidentified) {
    reasons.push("Unidentified temporary record — may be the same person as this emergency registration");
  }

  return {
    id: candidate.id,
    caseNumber: candidate.caseNumber,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    middleName: candidate.middleName,
    gender: candidate.gender,
    dateOfBirth: candidate.dateOfBirth.toISOString().slice(0, 10),
    phone: candidate.phone,
    email: candidate.email,
    unidentified: candidate.unidentified,
    score: Math.min(1, Math.round(score * 100) / 100),
    reasons,
  };
}

export const DUPLICATE_REVIEW_THRESHOLD = 0.45;

/**
 * Find patients that a new registration might duplicate. Candidates are
 * narrowed with an indexed OR query (name/DOB/phone/email/identity) and then
 * scored; only candidates above the review threshold are returned so staff
 * review a short, meaningful list.
 */
export async function findPotentialDuplicates(
  client: PrismaClient | Prisma.TransactionClient,
  facilityId: string,
  data: NewPatientInput,
): Promise<DuplicateMatch[]> {
  const dob = new Date(`${data.dateOfBirth}T00:00:00.000Z`);
  const dobNext = new Date(dob.getTime() + 86_400_000);
  const firstTokens = normalise(data.firstName).split(" ");
  const lastTokens = normalise(data.lastName).split(" ");

  const candidates = await client.patient.findMany({
    where: {
      deletedAt: null,
      OR: [
        { phone: data.phone ?? "__none__" },
        { email: data.email ?? "__none__" },
        { identityNumber: data.identityNumber ?? "__none__" },
        { dateOfBirth: { gte: dob, lt: dobNext } },
        {
          AND: [
            { firstName: { in: firstTokens, mode: "insensitive" } },
            { lastName: { in: lastTokens, mode: "insensitive" } },
          ],
        },
        { firstName: { equals: data.lastName, mode: "insensitive" }, lastName: { equals: data.firstName, mode: "insensitive" } },
      ],
    },
    select: {
      id: true, caseNumber: true, firstName: true, lastName: true, middleName: true, gender: true,
      dateOfBirth: true, phone: true, email: true, identityNumber: true, insuranceNumber: true, unidentified: true,
    },
    take: 50,
  });

  // Scoped to this facility's known patients via existing encounters.
  const linked = await client.encounter.findMany({
    where: { facilityId, patientId: { in: candidates.map((c) => c.id) } },
    select: { patientId: true },
    distinct: ["patientId"],
  });
  const linkedIds = new Set(linked.map((l) => l.patientId));
  const scoped = candidates.filter((c) => linkedIds.has(c.id));

  return scoped
    .map((c) => scoreDuplicate(data, c))
    .filter((m) => m.score >= DUPLICATE_REVIEW_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* Derived helpers                                                    */
/* ------------------------------------------------------------------ */

/** BMI from kg/cm — null when either measurement is missing. */
export function computeBmi(vitals?: VitalsInput): number | null {
  if (!vitals?.weightKg || !vitals?.heightCm) return null;
  const m = vitals.heightCm / 100;
  if (m <= 0) return null;
  return Math.round((vitals.weightKg / (m * m)) * 10) / 10;
}

/** Age in whole years from an ISO date string. */
export function computeAge(dateOfBirth: string, at = new Date()): number {
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    at.getUTCMonth() < dob.getUTCMonth() ||
    (at.getUTCMonth() === dob.getUTCMonth() && at.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** A minor (under the facility-configurable age of majority, default 18). */
export function isMinor(dateOfBirth: string, ageOfMajority = 18): boolean {
  return computeAge(dateOfBirth) < ageOfMajority;
}

/** Validate that required consents are acknowledged for a registration. */
export function validateConsents(consents: ConsentItem[], opts: { emergency: boolean }): string[] {
  const given = new Set(consents.filter((c) => c.status === "GIVEN").map((c) => c.key));
  const problems: string[] = [];
  for (const item of CONSENT_CATALOGUE) {
    if (!item.required) continue;
    if (opts.emergency) {
      // Emergency: general consent may be deferred; privacy notice still recorded.
      if (item.key === "general_admission") continue;
    }
    if (!given.has(item.key)) {
      problems.push(`Missing required consent acknowledgement: ${item.title} (v${item.version})`);
    }
  }
  return problems;
}
