/**
 * Medic1905 public homepage content.
 *
 * Pure data so it can be unit-tested and reused by the landing page and
 * footer without duplication. Every route targets a real application route;
 * features that are not implemented are omitted rather than advertised.
 */

export type ImedicsServiceAccess = "account" | "public";

export type ImedicsIcon =
  | "stethoscope"
  | "message-circle"
  | "calendar"
  | "flask"
  | "folder"
  | "file-text"
  | "heart-pulse"
  | "sparkles"
  | "activity"
  | "clipboard-list"
  | "shield-check"
  | "pill"
  | "scan"
  | "users"
  | "bar-chart"
  | "share-2";

export interface ImedicsServiceCard {
  title: string;
  description: string;
  href: string;
  icon: ImedicsIcon;
  access: ImedicsServiceAccess;
  /** Optional short badge, e.g. “New”, “Secure”, “For doctors”. */
  badge?: string;
}

export const IMEDICS_SERVICE_CARDS: readonly ImedicsServiceCard[] = [
  {
    title: "Find a Doctor",
    description: "Browse verified doctors by specialty, availability, language and location.",
    href: "/doctors",
    icon: "stethoscope",
    access: "account",
  },
  {
    title: "Consultations",
    description: "Start secure chat consultations, share documents and follow up with your doctor.",
    href: "/patient/consult",
    icon: "message-circle",
    access: "account",
    badge: "Secure",
  },
  {
    title: "Appointments",
    description: "Book, reschedule and track visits, reminders and follow-up appointments.",
    href: "/patient/appointments",
    icon: "calendar",
    access: "account",
  },
  {
    title: "Lab Tests & Results",
    description: "View laboratory results, reference ranges and trends as they are verified.",
    href: "/patient/results",
    icon: "flask",
    access: "account",
  },
  {
    title: "Health Records",
    description: "Your unified case file: diagnoses, documents, imaging, allergies and history.",
    href: "/patient/records",
    icon: "folder",
    access: "account",
    badge: "EHR",
  },
  {
    title: "Prescriptions",
    description: "View, download and print prescriptions issued by your doctors.",
    href: "/patient/prescriptions",
    icon: "file-text",
    access: "account",
  },
  {
    title: "Vitals & Monitoring",
    description: "Track blood pressure, weight, glucose and other measurements over time.",
    href: "/patient/vitals",
    icon: "activity",
    access: "account",
  },
  {
    title: "Medications",
    description: "Keep an organised medication list, including dosage, schedule and allergies.",
    href: "/patient/medications",
    icon: "pill",
    access: "account",
  },
  {
    title: "Imaging & Diagnostics",
    description: "Access imaging reports and diagnostic documents shared by your care team.",
    href: "/patient/imaging",
    icon: "scan",
    access: "account",
  },
  {
    title: "Emergency & CPR",
    description: "Life-saving guides and emergency numbers, available without an account.",
    href: "/emergency",
    icon: "heart-pulse",
    access: "public",
  },
  {
    title: "AI Health Assistant",
    description: "Ask health questions and receive clear, informational guidance.",
    href: "/ai-assistant",
    icon: "sparkles",
    access: "account",
  },
];

export interface ImedicsHomeSlide {
  id: string;
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
  icon: ImedicsIcon;
  /** Image path inside the public assets folder. */
  image?: string;
  imageAlt?: string;
}

/** Add a slide by appending an entry; the carousel adapts automatically. */
export const IMEDICS_HOME_SLIDES: readonly ImedicsHomeSlide[] = [
  {
    id: "unified-record",
    title: "One secure health record",
    description:
      "Consultations, laboratory results, prescriptions, imaging and documents in a single patient case file.",
    ctaHref: "/patient/records",
    ctaLabel: "Explore health records",
    icon: "folder",
    image: "/assets/ehr-dashboard.jpg",
    imageAlt: "A clinician reviewing a patient’s electronic health record on a tablet",
  },
  {
    id: "find-doctor",
    title: "Find a verified doctor",
    description:
      "Browse doctors by specialty and book a visit that fits your schedule.",
    ctaHref: "/doctors",
    ctaLabel: "Browse doctors",
    icon: "stethoscope",
    image: "/assets/doctor-consultation.jpg",
    imageAlt: "A doctor speaking with a patient during an online consultation",
  },
  {
    id: "lab-results",
    title: "Lab results you can follow",
    description:
      "Laboratory results arrive in your account as soon as they are verified, with reference ranges and trends.",
    ctaHref: "/patient/results",
    ctaLabel: "See lab results",
    icon: "flask",
    image: "/assets/laboratory-analysis.jpg",
    imageAlt: "A laboratory technician analysing patient samples",
  },
  {
    id: "emergency",
    title: "Emergency & CPR guides",
    description:
      "Life-saving steps and emergency numbers, available without an account.",
    ctaHref: "/emergency",
    ctaLabel: "Open guides",
    icon: "heart-pulse",
    image: "/assets/emergency-response.jpg",
    imageAlt: "Emergency response equipment and first-aid supplies",
  },
  {
    id: "ai-assistant",
    title: "AI health assistant",
    description:
      "Ask health questions and receive clear, informational answers any time.",
    ctaHref: "/ai-assistant",
    ctaLabel: "Try the assistant",
    icon: "sparkles",
    image: "/assets/ai-health-assistant.jpg",
    imageAlt: "A person using an AI health assistant on a smartphone",
  },
];

export interface ImedicsAdBanner {
  title: string;
  content: string;
  ctaHref: string;
  ctaLabel: string;
}

/**
 * The single ad banner on the homepage. Falls back to this default whenever
 * no HOMEPAGE_BANNER ad is active in the admin content manager.
 */
export const IMEDICS_SINGLE_AD_BANNER: ImedicsAdBanner = {
  title: "Medic1905 for organisations",
  content:
    "Hospitals, laboratories and diagnostic centres manage referrals, results, imaging and clinical workflows in one verified workspace.",
  ctaHref: "/facilities",
  ctaLabel: "Explore facilities",
};

export interface ImedicsFaqItem {
  question: string;
  answer: string;
}

export const IMEDICS_FAQS: readonly ImedicsFaqItem[] = [
  {
    question: "What is Medic1905?",
    answer:
      "Medic1905 is a healthcare platform that connects patients with verified doctors, hospitals, laboratories and diagnostic centres. It brings consultations, bookings, results, prescriptions and health records into one place.",
  },
  {
    question: "What is included in my health record?",
    answer:
      "Your record can include consultations, diagnoses, allergies, medications, laboratory results, imaging reports, documents, vitals and care-team notes — depending on what you and your providers choose to add.",
  },
  {
    question: "Do I need an account?",
    answer:
      "Browsing hospital and laboratory directories and reading emergency guides is open to everyone. Consultations, bookings, records and personal health tools require a free account.",
  },
  {
    question: "Is my health data secure?",
    answer:
      "Yes. Records use role-based access controls, encrypted storage and audit trails. You control what doctors and facilities can see, and access is limited to the care you authorise.",
  },
  {
    question: "Can I share records with another doctor?",
    answer:
      "Yes. You can grant time-limited or purpose-specific access to a doctor or facility, so they can review the relevant parts of your record without giving away your entire history.",
  },
  {
    question: "Is Medic1905 a medical provider?",
    answer:
      "No. Medic1905 is a platform. Doctors and facilities remain responsible for clinical decisions, and AI-assisted content is informational rather than medical advice.",
  },
];

export const IMEDICS_HOW_IT_WORKS_STEPS: readonly string[] = [
  "Create a free account with your email",
  "Find a verified doctor, hospital or laboratory",
  "Book a time and consult securely",
  "Receive results, prescriptions and follow-ups",
  "Build and control your lifelong health record",
];

export const IMEDICS_FEATURED_PANEL = {
  heading: "Your next step in healthcare",
  description:
    "Access Medic1905 to organise your care, follow your results and keep your health information in one secure place.",
  cta: "Log in",
  ctaHref: "/auth/login",
  secondaryCta: "Create an account",
  secondaryCtaHref: "/auth/signup",
} as const;

export const IMEDICS_FOOTER_LINKS: ReadonlyArray<{
  heading: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}> = [
  {
    heading: "Services",
    links: [
      { label: "Find a doctor", href: "/doctors" },
      { label: "Hospitals", href: "/hospitals" },
      { label: "Laboratories", href: "/laboratories" },
      { label: "Diagnostic centres", href: "/diagnostic-centres" },
      { label: "Pharmacies", href: "/pharmacies" },
      { label: "Emergency & CPR", href: "/emergency" },
    ],
  },
  {
    heading: "Health tools",
    links: [
      { label: "Health records", href: "/patient/records" },
      { label: "Lab results", href: "/patient/results" },
      { label: "Prescriptions", href: "/patient/prescriptions" },
      { label: "Vitals & monitoring", href: "/patient/vitals" },
      { label: "AI health assistant", href: "/ai-assistant" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Log in", href: "/auth/login" },
      { label: "Sign up", href: "/auth/signup" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Use", href: "/legal/terms" },
      { label: "Cookies Policy", href: "/legal/cookies" },
    ],
  },
];

export interface ImedicsNavLink {
  label: string;
  href: string;
  /** Hide from the compact desktop bar; still shown in the mobile menu. */
  compactOnly?: boolean;
}

export const IMEDICS_NAV_LINKS: readonly ImedicsNavLink[] = [
  { label: "Home", href: "/" },
  { label: "About Medic1905", href: "/about", compactOnly: true },
  { label: "For Doctors", href: "/doctors" },
  { label: "For Hospitals", href: "/hospitals", compactOnly: true },
  { label: "Laboratory", href: "/laboratories" },
  { label: "Diagnostic Centre", href: "/diagnostic-centres", compactOnly: true },
  { label: "Pharmacy", href: "/pharmacies", compactOnly: true },
  { label: "For Patients", href: "#for-patients" },
  { label: "EHR Features", href: "#features" },
  { label: "Contact Us", href: "#contact" },
];

export interface ImedicsAudience {
  key:
    | "patients"
    | "doctors"
    | "hospitals"
    | "laboratories"
    | "diagnostics"
    | "pharmacies";
  title: string;
  description: string;
  cta: string;
  href: string;
  image?: string;
  imageAlt?: string;
  highlights?: readonly string[];
}

export const IMEDICS_AUDIENCES: readonly ImedicsAudience[] = [
  {
    key: "patients",
    title: "For patients",
    description:
      "Find a doctor, book visits, consult securely and follow your results, prescriptions and complete case file in one place.",
    cta: "Get started",
    href: "/auth/signup",
    image: "/assets/patients-consultation.jpg",
    imageAlt: "A doctor speaking with a patient during an online consultation",
    highlights: [
      "Unified health record",
      "Lab and imaging results",
      "Prescriptions and medications",
      "Secure doctor messaging",
    ],
  },
  {
    key: "doctors",
    title: "For doctors",
    description:
      "A clinical workspace with patient records, consultations, AI-assisted analysis, prescribing and clinical documentation — independently or within a facility.",
    cta: "Join as a doctor",
    href: "/auth/signup",
    image: "/assets/doctors-workspace.jpg",
    imageAlt: "A health professional organising medication beside a laptop",
    highlights: [
      "Structured clinical notes",
      "Patient timeline and history",
      "Lab-result review",
      "e-Prescribing workflow",
    ],
  },
  {
    key: "hospitals",
    title: "For hospitals",
    description:
      "Wards, doctors, nurses, laboratory, pharmacy, billing and administration in one hospital-grade workspace with department-level permissions.",
    cta: "List your hospital",
    href: "/hospitals",
    image: "/assets/hospital-team.jpg",
    imageAlt: "A hospital care team collaborating in a clinical setting",
    highlights: [
      "Departmental workflows",
      "Role-based permissions",
      "Referrals and admissions",
      "Audit-ready activity logs",
    ],
  },
  {
    key: "laboratories",
    title: "Laboratories",
    description:
      "Receive requests, record and verify results, and release them directly to the patient’s case file and referring doctor.",
    cta: "Find a laboratory",
    href: "/laboratories",
    image: "/assets/laboratory-centrifuge.jpg",
    imageAlt: "A laboratory technician loading a sample into a centrifuge",
    highlights: [
      "Test-request intake",
      "Result verification",
      "Reference ranges",
      "Secure result delivery",
    ],
  },
  {
    key: "diagnostics",
    title: "Diagnostic centres",
    description:
      "Manage diagnostic and imaging examinations, verify reports and share them securely with patients and referrers.",
    cta: "Find a centre",
    href: "/diagnostic-centres",
    image: "/assets/diagnostics-radiology.jpg",
    imageAlt: "A modern diagnostic imaging suite with scanners",
    highlights: [
      "Imaging requests",
      "Report verification",
      "Document sharing",
      "Referrer notifications",
    ],
  },
  {
    key: "pharmacies",
    title: "Pharmacies",
    description:
      "Receive prescriptions from doctors, manage your formulary and serve patients from a dedicated pharmacy workspace.",
    cta: "Find a pharmacy",
    href: "/pharmacies",
    image: "/assets/pharmacy-counter.jpg",
    imageAlt: "A pharmacist preparing medication at a pharmacy counter",
    highlights: [
      "Digital prescriptions",
      "Medication inventory",
      "Patient medication history",
      "Dispensing workflow",
    ],
  },
];

export interface ImedicsBenefit {
  title: string;
  description: string;
  icon: ImedicsIcon;
}

/** Key EHR/EMR platform benefits — the #features section. */
export const IMEDICS_BENEFITS: readonly ImedicsBenefit[] = [
  {
    title: "One central case file",
    description:
      "Every consultation, result, prescription, image and document is stored in a single patient case file rather than scattered across departments.",
    icon: "folder",
  },
  {
    title: "Complete patient timeline",
    description:
      "View visits, diagnoses, treatments, allergies, medications, laboratory results and documents in chronological order.",
    icon: "clipboard-list",
  },
  {
    title: "Structured clinical documentation",
    description:
      "Doctors can create consistent consultation notes, diagnoses, care plans and follow-up tasks using structured clinical templates.",
    icon: "file-text",
  },
  {
    title: "Medication and allergy safety",
    description:
      "Maintain an up-to-date medication list, record allergies and flag important clinical information for the care team.",
    icon: "pill",
  },
  {
    title: "Laboratory and diagnostic results",
    description:
      "Receive verified laboratory and imaging results with reference ranges, trends and the interpreting clinician’s report.",
    icon: "flask",
  },
  {
    title: "Imaging and document management",
    description:
      "Store and retrieve scans, reports, referrals and clinical documents with clear versioning and access permissions.",
    icon: "scan",
  },
  {
    title: "Vitals and remote monitoring",
    description:
      "Track blood pressure, weight, glucose, temperature and other measurements to give clinicians a clearer longitudinal view.",
    icon: "activity",
  },
  {
    title: "Secure sharing and referrals",
    description:
      "Share selected records with a doctor, laboratory or diagnostic centre, with permissions and an auditable access trail.",
    icon: "share-2",
  },
  {
    title: "Verified doctors and facilities",
    description:
      "Hospitals, laboratories, diagnostic centres and pharmacies are verified organisations; doctor credentials are checked at registration.",
    icon: "shield-check",
  },
  {
    title: "Care-team collaboration",
    description:
      "Doctors, nurses, laboratories and administrators work from shared, permission-controlled information instead of disconnected systems.",
    icon: "users",
  },
  {
    title: "Operational insights",
    description:
      "Facilities can monitor appointments, referrals, results and workflow activity to improve coordination and service delivery.",
    icon: "bar-chart",
  },
  {
    title: "AI-assisted, doctor-checked",
    description:
      "AI tools support questions, summarisation and analysis, while clinical decisions always remain with doctors and facilities.",
    icon: "sparkles",
  },
];

export interface ImedicsContact {
  heading: string;
  description: string;
  email: string;
  emergency: {
    text: string;
    cta: string;
    href: string;
  };
}

export const IMEDICS_CONTACT: ImedicsContact = {
  heading: "Contact and support",
  description:
    "Questions about your account, booking, records or listing a facility? Our support team replies within one business day.",
  email: "support@medic1905.com",
  emergency: {
    text: "In an emergency, call your local emergency number immediately.",
    cta: "Emergency & CPR guides",
    href: "/emergency",
  },
};

export const IMEDICS_IMAGE_CREDITS: readonly string[] = [
  "Health-record and consultation photographs by Shixart1985, CC BY 2.0, via Wikimedia Commons",
  "Laboratory and diagnostic photographs by Goleisureintl, CC BY-SA 4.0, via Wikimedia Commons",
];
