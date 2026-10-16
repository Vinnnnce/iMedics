/**
 * Public homepage content. Pure data so it can be unit-tested and reused by the
 * marketing page, the pricing page, and the public footer without duplication.
 * Every CTA targets a real route (enforced in home-content.test.ts).
 */

export interface Specialty { name: string; query: string }

export const SPECIALTIES: readonly Specialty[] = [
  { name: "General practice", query: "General practice" },
  { name: "Internal medicine", query: "Internal medicine" },
  { name: "Paediatrics", query: "Paediatrics" },
  { name: "Obstetrics and gynaecology", query: "Obstetrics and gynaecology" },
  { name: "Cardiology", query: "Cardiology" },
  { name: "Vascular surgery", query: "Vascular surgery" },
  { name: "Dermatology", query: "Dermatology" },
  { name: "Orthopaedics", query: "Orthopaedics" },
  { name: "Psychiatry", query: "Psychiatry" },
  { name: "Endocrinology", query: "Endocrinology" },
  { name: "Radiology", query: "Radiology" },
  { name: "Laboratory medicine", query: "Laboratory medicine" },
];

export interface ServiceCard {
  title: string;
  description: string;
  cta: string;
  href: string;
}

export const SERVICE_CARDS: readonly ServiceCard[] = [
  {
    title: "Online doctor consultation",
    description: "Secure chat consultation with verified doctors; book visits in one place.",
    cta: "Find a doctor",
    href: "/doctors",
  },
  {
    title: "Laboratory tests",
    description: "Book tests and receive digital results.",
    cta: "Find a laboratory",
    href: "/facilities",
  },
  {
    title: "Diagnostics & imaging",
    description: "Ultrasound, X-ray, CT, MRI, ECG, and more.",
    cta: "Find a diagnostic centre",
    href: "/facilities",
  },
  {
    title: "Hospitals & specialists",
    description: "In-person and virtual specialist care.",
    cta: "Explore hospitals",
    href: "/facilities",
  },
];

export const HOW_IT_WORKS_STEPS: readonly string[] = [
  "Create a secure Medic1905 account",
  "Search for a doctor, laboratory, hospital, or diagnostic centre",
  "Choose a service and appointment time",
  "Pay securely",
  "Attend the consultation or visit the facility",
  "Receive results, reports, prescriptions, and follow-up guidance",
];

export const TRUST_ITEMS: readonly string[] = [
  "Verified doctor credentials",
  "Secure messaging and encrypted records",
  "Transparent consultation fees",
  "Digital prescriptions and reports",
  "Secure case-number-based record keeping",
  "Patient-controlled sharing permissions",
];

export const PROVIDER_BENEFITS: readonly string[] = [
  "Reach more patients",
  "Manage appointments and consultations",
  "Set your fees",
  "Receive secure payments",
  "Access telemedicine tools",
  "Use AI-enabled features on eligible plans",
  "Choose a subscription plan that fits your practice",
];

export const HERO_TRUST_BADGES: readonly string[] = [
  "Verified doctors",
  "Secure consultations",
  "Laboratory and diagnostic partnerships",
  "Secure health records",
  "Nigeria-focused care",
];

export const EMERGENCY_NUMBERS = { national: "112", lagos: "767" } as const;

/** Filters specialties by a case-insensitive, accented-insensitive search term. */
export function filterSpecialties(specialties: readonly Specialty[], term: string): readonly Specialty[] {
  const needle = term.trim().toLocaleLowerCase();
  if (!needle) return specialties;
  return specialties.filter(s => s.name.toLocaleLowerCase().includes(needle));
}