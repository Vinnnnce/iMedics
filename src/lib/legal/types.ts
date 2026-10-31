import type { AccountType, Role } from "@prisma/client";

/**
 * The account audiences the legal policies are tailored to. The six account
 * types users register with (Patient, Doctor, Hospital, Laboratory, Diagnostic
 * Centre, Pharmacy) map to their own policy audience. Signed-out visitors,
 * admins and accounts with an unknown type get GENERAL, which shows every
 * audience section instead of silently defaulting to one type.
 */
export const POLICY_AUDIENCES = [
  "GENERAL",
  "PATIENT",
  "DOCTOR",
  "HOSPITAL",
  "LABORATORY",
  "DIAGNOSTIC_CENTRE",
  "PHARMACY",
] as const;

export type PolicyAudience = (typeof POLICY_AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<PolicyAudience, string> = {
  GENERAL: "General",
  PATIENT: "Patient",
  DOCTOR: "Doctor",
  HOSPITAL: "Hospital",
  LABORATORY: "Laboratory",
  DIAGNOSTIC_CENTRE: "Diagnostic centre",
  PHARMACY: "Pharmacy",
};

export interface PolicyUser {
  role?: Role | null;
  accountType?: AccountType | null;
}

/**
 * Resolve the policy audience for a signed-in user. Facility roles keep the
 * facility's account type (Hospital / Laboratory / Diagnostic Centre); doctors
 * and patients follow their account type or role. Anything else — including
 * signed-out visitors and admins — resolves to GENERAL.
 */
export function policyAudienceFor(user: PolicyUser | null | undefined): PolicyAudience {
  if (!user) return "GENERAL";
  switch (user.accountType) {
    case "PATIENT":
      return "PATIENT";
    case "DOCTOR":
      return "DOCTOR";
    case "HOSPITAL":
      return "HOSPITAL";
    case "LABORATORY":
      return "LABORATORY";
    case "DIAGNOSTIC_CENTRE":
      return "DIAGNOSTIC_CENTRE";
    case "PHARMACY":
      return "PHARMACY";
    default:
      break;
  }
  // Legacy or partial accounts: fall back to the role when it is unambiguous.
  if (user.role === "DOCTOR") return "DOCTOR";
  if (user.role === "PATIENT") return "PATIENT";
  return "GENERAL";
}

/** One section of a policy document. */
export interface PolicySection {
  id: string;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Emphasised callout rendered inside the section. */
  note?: string;
}

/** A block of sections that applies to one account audience. */
export interface AudienceSection {
  audience: PolicyAudience;
  sections: PolicySection[];
}

/** Shared metadata for all three policies (kept in one place to stay in sync). */
export const LEGAL_META = {
  platformName: "Medic1905",
  lastUpdated: "17 October 2026",
  /** Bumped whenever the policies materially change; recorded at registration. */
  version: "2026-10.1",
  /**
   * Operator identity. These are deliberate placeholders: the operator's
   * registered entity name, CAC registration number and office address must
   * be confirmed and inserted before the policies are relied on in production.
   */
  operatorName: "[Operator legal entity — to be inserted]",
  operatorAddress: "[Registered office address — to be inserted]",
  operatorRc: "[CAC registration number — to be inserted]",
  contactEmail: "privacy@medic1905.com",
} as const;

/** Links shown in the sidebar footer (desktop and mobile) and legal pages. */
export const LEGAL_NAV_LINKS = [
  { href: "/legal/terms", label: "Terms of Use" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/about", label: "About" },
] as const;

/** Official sources for the Nigerian laws referenced in the policies. */
export const LEGAL_SOURCES = [
  { label: "Nigeria Data Protection Commission (NDPC)", url: "https://www.ndpc.gov.ng" },
  {
    label: "Nigeria Data Protection Act 2023 (full text)",
    url: "https://cert.gov.ng/ngcert/resources/Nigeria_Data_Protection_Act_2023.pdf",
  },
  {
    label: "NDPC General Application and Implementation Directive 2025",
    url: "https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf",
  },
  { label: "Laws of the Federation of Nigeria", url: "https://www.lawsofnigeria.gov.ng" },
] as const;

export const LEGAL_DISCLAIMER =
  "This policy is provided for information only and does not constitute legal advice. " +
  "It summarises how the platform works and the rules that apply to your account. " +
  "For advice about your specific legal or professional obligations, consult a qualified " +
  "lawyer or your professional regulator. We review and update these policies regularly, " +
  "and the version shown here may not reflect every recent change in Nigerian law.";
