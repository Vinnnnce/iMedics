import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { priceSchema, currencySchema } from "./money";

/**
 * Medic1905 doctor profile, services and portfolio.
 *
 * Everything here is additive to the existing doctor model: fields are optional, arrays default to
 * empty, and nothing is shown publicly unless the doctor (or an admin) publishes it. Licence and
 * registration numbers stay private unless the doctor opts into `licensePublic`.
 */

export const DOCTOR_PROFILE_LIMITS = {
  title: 120,
  text: 4000,
  shortText: 500,
  listItems: 40,
} as const;

const listOf = (max: number, itemMax = 120) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(max);

/** Fields a doctor may edit on their own professional profile. */
export const doctorProfileUpdateSchema = z.object({
  professionalTitle: z.string().trim().max(DOCTOR_PROFILE_LIMITS.title).nullable(),
  qualifications: z.string().trim().max(DOCTOR_PROFILE_LIMITS.shortText).nullable(),
  clinicalInterests: listOf(DOCTOR_PROFILE_LIMITS.listItems),
  conditionsTreated: listOf(DOCTOR_PROFILE_LIMITS.listItems),
  proceduresPerformed: listOf(DOCTOR_PROFILE_LIMITS.listItems),
  patientCarePhilosophy: z.string().trim().max(DOCTOR_PROFILE_LIMITS.text).nullable(),
  consultationApproach: z.string().trim().max(DOCTOR_PROFILE_LIMITS.text).nullable(),
  whenToBookGuidance: z.string().trim().max(DOCTOR_PROFILE_LIMITS.text).nullable(),
  // Empty array = not specified; booking then offers the platform defaults.
  consultationModes: z.array(z.enum(["VIDEO", "CHAT", "IN_PERSON"])).max(3),
  linkedinUrl: z
    .string()
    .trim()
    .url()
    .refine((v) => /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(v), "Must be a LinkedIn profile URL")
    .max(300)
    .nullable(),
  linkedinPublic: z.boolean(),
  cvFileId: z.string().uuid().nullable(),
  licensingAuthority: z.string().trim().max(DOCTOR_PROFILE_LIMITS.shortText).nullable(),
  licenseExpiry: z.coerce.date().nullable(),
  licensePublic: z.boolean(),
  professionalMemberships: listOf(DOCTOR_PROFILE_LIMITS.listItems, 200),
  awards: listOf(DOCTOR_PROFILE_LIMITS.listItems, 200),
  hospitalAffiliations: listOf(DOCTOR_PROFILE_LIMITS.listItems, 200),
});

export type DoctorProfileUpdate = z.infer<typeof doctorProfileUpdateSchema>;

/** The doctor-facing profile payload (own data, including unpublished bits). */
export const doctorSelfSelect = {
  professionalTitle: true,
  qualifications: true,
  clinicalInterests: true,
  conditionsTreated: true,
  proceduresPerformed: true,
  patientCarePhilosophy: true,
  consultationApproach: true,
  whenToBookGuidance: true,
  consultationModes: true,
  linkedinUrl: true,
  linkedinPublic: true,
  linkedinConsentAt: true,
  cvFileId: true,
  licensingAuthority: true,
  licenseExpiry: true,
  licensePublic: true,
  professionalMemberships: true,
  awards: true,
  hospitalAffiliations: true,
  identityVerification: true,
  licenseVerification: true,
  qualificationVerification: true,
  verificationStatus: true,
  specialty: true,
  subSpecialty: true,
  biography: true,
  education: true,
  languages: true,
  areasOfExpertise: true,
  affiliation: true,
  location: true,
  yearsOfExperience: true,
} satisfies Prisma.DoctorProfileSelect;

/** Extra public fields the profile page shows once a doctor publishes them. */
export const doctorPublicExtrasSelect = {
  professionalTitle: true,
  qualifications: true,
  clinicalInterests: true,
  conditionsTreated: true,
  proceduresPerformed: true,
  patientCarePhilosophy: true,
  consultationApproach: true,
  whenToBookGuidance: true,
  consultationModes: true,
  linkedinUrl: true,
  linkedinPublic: true,
  cvFileId: true,
  licensingAuthority: true,
  licenseExpiry: true,
  licensePublic: true,
  professionalMemberships: true,
  awards: true,
  hospitalAffiliations: true,
  identityVerification: true,
  licenseVerification: true,
  qualificationVerification: true,
} satisfies Prisma.DoctorProfileSelect;

/* ------------------------------------------------------------------ services */

export const SERVICE_KINDS = ["NEW_PATIENT", "FOLLOW_UP", "SECOND_OPINION", "POST_OP_REVIEW", "REPORT_REVIEW", "OTHER"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const SERVICE_KIND_LABELS: Record<ServiceKind, string> = {
  NEW_PATIENT: "New patient consultation",
  FOLLOW_UP: "Follow-up consultation",
  SECOND_OPINION: "Second opinion",
  POST_OP_REVIEW: "Post-operative review",
  REPORT_REVIEW: "Report review",
  OTHER: "Other service",
};

export const doctorServiceInputSchema = z
  .object({
    kind: z.enum(SERVICE_KINDS),
    name: z.string().trim().min(3).max(120),
    description: z.string().trim().max(2000).nullable(),
    modes: z.array(z.enum(["VIDEO", "CHAT", "IN_PERSON"])).max(3),
    durationMinutes: z.number().int().min(5).max(240),
    currency: currencySchema,
    price: priceSchema,
    followUpPrice: priceSchema.nullable(),
    followUpWindowDays: z.number().int().min(1).max(90).nullable(),
    isActive: z.boolean(),
    icd10Codes: z.array(z.string().trim().min(1).max(20)).max(20),
    cancellationTerms: z.string().trim().max(2000).nullable(),
    refundTerms: z.string().trim().max(2000).nullable(),
    includes: listOf(20, 200),
    addOns: listOf(20, 200),
  })
  .refine((v) => v.followUpPrice === null || v.followUpWindowDays !== null, {
    path: ["followUpWindowDays"],
    message: "A follow-up price needs an eligibility window",
  });

export type DoctorServiceInput = z.infer<typeof doctorServiceInputSchema>;

export const doctorServiceSelect = {
  id: true,
  kind: true,
  name: true,
  description: true,
  modes: true,
  durationMinutes: true,
  currency: true,
  price: true,
  followUpPrice: true,
  followUpWindowDays: true,
  isActive: true,
  icd10Codes: true,
  cancellationTerms: true,
  refundTerms: true,
  includes: true,
  addOns: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DoctorServiceSelect;

type ServiceRow = Prisma.DoctorServiceGetPayload<{ select: typeof doctorServiceSelect }>;

/** JSON-safe service (Decimal -> number). */
export function serializeDoctorService(s: ServiceRow) {
  return {
    ...s,
    price: Number(s.price),
    followUpPrice: s.followUpPrice === null ? null : Number(s.followUpPrice),
  };
}

/* ---------------------------------------------------------------- portfolio */

export const PORTFOLIO_TYPES = [
  "EDUCATION", "WORK_HISTORY", "FELLOWSHIP", "PUBLICATION", "PRESENTATION",
  "CASE_STUDY", "MEDIA_APPEARANCE", "AWARD", "OUTREACH",
] as const;
export type PortfolioType = (typeof PORTFOLIO_TYPES)[number];

export const PORTFOLIO_TYPE_LABELS: Record<PortfolioType, string> = {
  EDUCATION: "Education",
  WORK_HISTORY: "Work history",
  FELLOWSHIP: "Fellowship & training",
  PUBLICATION: "Publications & research",
  PRESENTATION: "Conference presentations",
  CASE_STUDY: "Case studies",
  MEDIA_APPEARANCE: "Media & talks",
  AWARD: "Awards",
  OUTREACH: "Outreach activities",
};

export const doctorPortfolioInputSchema = z.object({
  type: z.enum(PORTFOLIO_TYPES),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).nullable(),
  externalUrl: z.string().trim().url().max(500).nullable(),
  publishedAt: z.coerce.date().nullable(),
  attachmentFileId: z.string().uuid().nullable(),
  visibility: z.enum(["PRIVATE", "PUBLIC"]),
  consentStatus: z.enum(["PENDING", "GRANTED", "DENIED"]),
});

export type DoctorPortfolioInput = z.infer<typeof doctorPortfolioInputSchema>;

/**
 * Whether a portfolio item may be shown on the public profile.
 * Case studies hold patient-adjacent material, so they additionally require recorded patient consent.
 */
export function portfolioItemIsPublic(item: { visibility: string; consentStatus: string; type: string }) {
  if (item.visibility !== "PUBLIC") return false;
  if (item.type === "CASE_STUDY") return item.consentStatus === "GRANTED";
  return true;
}

/** Public portfolio shape (no consent internals). */
export function serializePublicPortfolioItem(item: {
  id: string; type: string; title: string; description: string | null;
  externalUrl: string | null; publishedAt: Date | null; attachmentFileId: string | null;
}) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    externalUrl: item.externalUrl,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    // Downloads still go through the permission-checked endpoint; this id is only a pointer.
    attachmentFileId: item.attachmentFileId,
  };
}
