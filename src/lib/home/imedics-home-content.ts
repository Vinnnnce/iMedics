/**
 * Medic1905 public homepage content.
 *
 * Pure data module: no React, DOM, or routing dependencies. It can be unit
 * tested and reused by the landing page, footer, mobile navigation, and CMS.
 *
 * Every `href` must target a real application route. Features that are not
 * implemented must not be advertised.
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
  | "shield-check"
  | "scan"
  | "users"
  | "activity"
  | "pill"
  | "share-2"
  | "bar-chart"
  | "lock";

export interface ImedicsServiceCard {
  title: string;
  description: string;
  href: string;
  icon: ImedicsIcon;
  access: ImedicsServiceAccess;
  /** Short label for compact/mobile layouts. */
  shortTitle?: string;
}

export const IMEDICS_SERVICE_CARDS: readonly ImedicsServiceCard[] = [
  {
    title: "Unified Health Record",
    shortTitle: "Health Record",
    description:
      "One secure patient record for consultations, diagnoses, medications, allergies, immunisations, documents, and care history.",
    href: "/patient/records",
    icon: "folder",
    access: "account",
  },
  {
    title: "Find a Doctor",
    description:
      "Browse verified doctors by specialty, language, availability, and location, then book an in-person or telehealth visit.",
    href: "/doctors",
    icon: "stethoscope",
    access: "account",
  },
  {
    title: "Consultations",
    description:
      "Start secure text, audio, or video consultations, share documents, and receive structured clinical notes.",
    href: "/patient/consult",
    icon: "message-circle",
    access: "account",
  },
  {
    title: "Appointments",
    description:
      "Manage bookings, reschedule visits, receive reminders, and track upcoming consultations and procedures.",
    href: "/patient/appointments",
    icon: "calendar",
    access: "account",
  },
  {
    title: "Lab Tests & Results",
    description:
      "View laboratory results with reference ranges, trends over time, abnormal-value flags, and clinician interpretation.",
    href: "/patient/results",
    icon: "flask",
    access: "account",
  },
  {
    title: "Imaging & Diagnostics",
    description:
      "Access imaging reports and diagnostic results, download documents where permitted, and share them with a chosen clinician.",
    href: "/patient/imaging",
    icon: "scan",
    access: "account",
  },
  {
    title: "Prescriptions",
    shortTitle: "e-Prescriptions",
    description:
      "View, download, and share electronic prescriptions, including medication details, dosage instructions, and renewal status.",
    href: "/patient/prescriptions",
    icon: "file-text",
    access: "account",
  },
  {
    title: "Medications & Allergies",
    description:
      "Maintain an active medication list, record allergies and adverse reactions, and help clinicians reduce prescribing risks.",
    href: "/patient/medications",
    icon: "pill",
    access: "account",
  },
  {
    title: "Referrals & Care Team",
    description:
      "Track referrals between doctors, hospitals, laboratories, and diagnostic centres, with clear ownership at every step.",
    href: "/patient/referrals",
    icon: "users",
    access: "account",
  },
  {
    title: "Vital Signs & Trends",
    description:
      "Record blood pressure, weight, glucose, and other measurements, then visualise changes across time.",
    href: "/patient/vitals",
    icon: "activity",
    access: "account",
  },
  {
    title: "Consent & Sharing",
    description:
      "Control who can access your record, grant time-limited sharing permissions, and review the access history.",
    href: "/patient/consent",
    icon: "share-2",
    access: "account",
  },
  {
    title: "Emergency & CPR",
    description:
      "Life-saving guides, emergency numbers, allergy and medication summaries, and critical information for first responders.",
    href: "/emergency",
    icon: "heart-pulse",
    access: "public",
  },
  {
    title: "AI Health Assistant",
    description:
      "Ask general health questions and receive clear, informational guidance. AI output does not replace clinical advice.",
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
  image?: string;
  /** Optional short version for small screens. */
  mobileTitle?: string;
  mobileDescription?: string;
}

export const IMEDICS_HOME_SLIDES: readonly ImedicsHomeSlide[] = [
  {
    id: "unified-record",
    title: "One secure health record",
    mobileTitle: "Your health record",
    description:
      "Consultations, results, prescriptions, imaging, and documents come together in a single patient-centred record.",
    ctaHref: "/patient/records",
    ctaLabel: "Explore records",
    icon: "folder",
  },
  {
    id: "find-doctor",
    title: "Find a verified doctor",
    mobileTitle: "Find a doctor",
    description:
      "Browse doctors by specialty and availability, then book an in-person or telehealth appointment.",
    ctaHref: "/doctors",
    ctaLabel: "Browse doctors",
    icon: "stethoscope",
  },
  {
    id: "lab-results",
    title: "Lab results you can understand",
    mobileTitle: "Lab results",
    description:
      "See verified laboratory results, reference ranges, trends, and your clinician’s interpretation in one place.",
    ctaHref: "/patient/results",
    ctaLabel: "See lab results",
    icon: "flask",
  },
  {
    id: "imaging",
    title: "Imaging and diagnostics",
    mobileTitle: "Diagnostics",
    description:
      "Receive diagnostic reports securely and share them with the clinicians involved in your care.",
    ctaHref: "/patient/imaging",
    ctaLabel: "View diagnostics",
    icon: "scan",
  },
  {
    id: "emergency",
    title: "Emergency & CPR guides",
    mobileTitle: "Emergency help",
    description:
      "Life-saving steps and emergency numbers are available without an account.",
    ctaHref: "/emergency",
    ctaLabel: "Open guides",
    icon: "heart-pulse",
  },
  {
    id: "ai-assistant",
    title: "AI health assistant",
    description:
      "Ask general health questions and receive clear informational guidance, with clinical decisions left to professionals.",
    ctaHref: "/ai-assistant",
    ctaLabel: "Try the assistant",
    icon: "sparkles",
  },
];

export interface ImedicsAdBanner {
  title: string;
  content: string;
  ctaHref: string;
  ctaLabel: string;
}

export const IMEDICS_SINGLE_AD_BANNER: ImedicsAdBanner = {
  title: "Medic1905 for healthcare organisations",
  content:
    "Hospitals, laboratories, diagnostic centres, and pharmacies manage referrals, records, results, imaging, and prescribing in one verified workspace.",
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
      "Medic1905 is a healthcare platform that connects patients with verified doctors, hospitals, laboratories, diagnostic centres, and pharmacies. It brings appointments, consultations, records, results, prescriptions, and referrals into one secure workspace.",
  },
  {
    question: "What is included in my electronic health record?",
    answer:
      "Your record can include demographics, allergies, medications, immunisations, diagnoses, consultation notes, laboratory and imaging results, documents, vital signs, referrals, and care-team information. Availability depends on the services and clinicians you use.",
  },
  {
    question: "Do I need an account?",
    answer:
      "Browsing provider directories and emergency guides is public. Creating a record, booking care, consulting a clinician, and viewing personal medical information requires a free account.",
  },
  {
    question: "Can I control who sees my information?",
    answer:
      "Yes. You can grant or revoke sharing permissions, define what a clinician or facility can access, and review access activity where supported.",
  },
  {
    question: "Is my health data secure?",
    answer:
      "Medic1905 is designed around role-based access, encrypted storage, consent controls, and audit trails. Access is limited to the people and organisations you authorise or that are involved in your care.",
  },
  {
    question: "Is Medic1905 a medical provider?",
    answer:
      "No. Medic1905 provides the digital infrastructure. Doctors and facilities remain responsible for diagnosis, treatment, and clinical decisions. AI-assisted content is informational and never a substitute for professional medical advice.",
  },
];

export interface ImedicsHowItWorksStep {
  title: string;
  description: string;
  icon: ImedicsIcon;
}

export const IMEDICS_HOW_IT_WORKS_STEPS: readonly ImedicsHowItWorksStep[] = [
  {
    title: "Create your account",
    description: "Register with your email and complete your basic health profile.",
    icon: "users",
  },
  {
    title: "Find the right care",
    description: "Search verified doctors, hospitals, laboratories, and diagnostic centres.",
    icon: "stethoscope",
  },
  {
    title: "Book and consult",
    description: "Choose an appointment or start a secure telehealth consultation.",
    icon: "calendar",
  },
  {
    title: "Follow your care",
    description: "Receive results, prescriptions, referrals, and follow-up information in one record.",
    icon: "activity",
  },
];

export const IMEDICS_FEATURED_PANEL = {
  heading: "Your next step in healthcare",
  description:
    "Create an account to manage your health record, book care, consult securely, and follow your results and prescriptions.",
  cta: "Log in",
  ctaHref: "/auth/login",
  secondaryCta: "Create an account",
  secondaryCtaHref: "/auth/signup",
} as const;

export interface ImedicsFooterLinkGroup {
  heading: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}

export const IMEDICS_FOOTER_LINKS: readonly ImedicsFooterLinkGroup[] = [
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
    heading: "Patients",
    links: [
      { label: "Health record", href: "/patient/records" },
      { label: "Appointments", href: "/patient/appointments" },
      { label: "Lab results", href: "/patient/results" },
      { label: "Prescriptions", href: "/patient/prescriptions" },
      { label: "Consent & sharing", href: "/patient/consent" },
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
  /** Hide from the compact desktop bar; still available in the mobile menu. */
  compactOnly?: boolean;
}

export const IMEDICS_NAV_LINKS: readonly ImedicsNavLink[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about", compactOnly: true },
  { label: "For Doctors", href: "/doctors" },
  { label: "Hospitals", href: "/hospitals", compactOnly: true },
  { label: "Laboratories", href: "/laboratories" },
  { label: "Diagnostics", href: "/diagnostic-centres", compactOnly: true },
  { label: "Pharmacies", href: "/pharmacies", compactOnly: true },
  { label: "For Patients", href: "#for-patients" },
  { label: "EHR Features", href: "#features" },
  { label: "Contact", href: "#contact" },
];

export type ImedicsAudienceKey =
  | "patients"
  | "doctors"
  | "hospitals"
  | "laboratories"
  | "diagnostics"
  | "pharmacies";

export interface ImedicsAudience {
  key: ImedicsAudienceKey;
  title: string;
  description: string;
  cta: string;
  href: string;
  image?: string;
  imageAlt?: string;
  /** Capabilities highlighted in the audience card. */
  highlights: readonly string[];
}

export const IMEDICS_AUDIENCES: readonly ImedicsAudience[] = [
  {
    key: "patients",
    title: "For patients",
    description:
      "Find care, book visits, consult securely, and follow your complete health journey in one personal record.",
    cta: "Get started",
    href: "/auth/signup",
    image: "/home/patients-consultation.jpg",
    imageAlt: "A doctor speaking with a patient during an online consultation",
    highlights: [
      "Personal health record",
      "Telehealth consultations",
      "Lab and imaging results",
      "e-Prescriptions and referrals",
    ],
  },
  {
    key: "doctors",
    title: "For doctors",
    description:
      "Use a clinical workspace for patients, consultations, structured notes, AI-assisted review, prescribing, and referrals.",
    cta: "Join as a doctor",
    href: "/auth/signup",
    image: "/home/doctors-workspace.jpg",
    imageAlt: "A health professional organising medication beside a laptop",
    highlights: [
      "Patient timeline",
      "Structured clinical notes",
      "e-Prescribing",
      "Referral management",
    ],
  },
  {
    key: "hospitals",
    title: "For hospitals",
    description:
      "Coordinate wards, clinicians, nursing, laboratory, pharmacy, billing, and administration with department-level permissions.",
    cta: "List your hospital",
    href: "/hospitals",
    highlights: [
      "Department workflows",
      "Role-based access",
      "Referrals and admissions",
      "Operational dashboards",
    ],
  },
  {
    key: "laboratories",
    title: "Laboratories",
    description:
      "Receive requests, record and verify results, apply quality controls, and release results directly to the patient record.",
    cta: "Find a laboratory",
    href: "/laboratories",
    image: "/home/laboratory-centrifuge.jpg",
    imageAlt: "A laboratory technician loading a sample into a centrifuge",
    highlights: [
      "Test catalogues",
      "Result verification",
      "Reference ranges",
      "Secure result release",
    ],
  },
  {
    key: "diagnostics",
    title: "Diagnostic centres",
    description:
      "Manage imaging and diagnostic examinations, verify reports, and share authorised results with patients and referrers.",
    cta: "Find a centre",
    href: "/diagnostic-centres",
    image: "/home/diagnostics-radiology.jpg",
    imageAlt: "A modern diagnostic imaging suite with scanners",
    highlights: [
      "Imaging workflows",
      "Report verification",
      "Secure sharing",
      "Referrer access",
    ],
  },
  {
    key: "pharmacies",
    title: "Pharmacies",
    description:
      "Receive prescriptions, manage inventory and formularies, and support patients from a dedicated pharmacy workspace.",
    cta: "Find a pharmacy",
    href: "/pharmacies",
    highlights: [
      "e-Prescription intake",
      "Formulary management",
      "Dispensing records",
      "Patient support",
    ],
  },
];

export interface ImedicsEhrCapability {
  title: string;
  description: string;
  icon: ImedicsIcon;
  /** Use for responsive prioritisation and optional feature filtering. */
  category: "record" | "clinical" | "interoperability" | "security" | "analytics";
  /** Shorter label for mobile grids. */
  mobileTitle?: string;
}

export const IMEDICS_EHR_CAPABILITIES: readonly ImedicsEhrCapability[] = [
  {
    title: "Patient-centred record",
    mobileTitle: "Unified record",
    description:
      "A longitudinal record combines demographics, problems, medications, allergies, immunisations, documents, and care history.",
    icon: "folder",
    category: "record",
  },
  {
    title: "Structured clinical documentation",
    mobileTitle: "Clinical notes",
    description:
      "Clinicians document encounters with structured templates, problem lists, assessments, and care plans.",
    icon: "file-text",
    category: "clinical",
  },
  {
    title: "Medication management",
    mobileTitle: "Medications",
    description:
      "Maintain active medications, allergies, dosage instructions, interactions awareness, and prescription history.",
    icon: "pill",
    category: "clinical",
  },
  {
    title: "Electronic prescribing",
    mobileTitle: "e-Prescribing",
    description:
      "Doctors issue digital prescriptions that patients can view, download, and share with participating pharmacies.",
    icon: "file-text",
    category: "clinical",
  },
  {
    title: "Laboratory integration",
    mobileTitle: "Lab results",
    description:
      "Laboratory orders and verified results flow into the patient record with reference ranges and trend context.",
    icon: "flask",
    category: "interoperability",
  },
  {
    title: "Imaging and diagnostics",
    mobileTitle: "Imaging",
    description:
      "Diagnostic reports and authorised imaging documents are available alongside the relevant clinical context.",
    icon: "scan",
    category: "interoperability",
  },
  {
    title: "Referrals and care coordination",
    mobileTitle: "Referrals",
    description:
      "Send, receive, and track referrals across clinicians and facilities, with transparent status and ownership.",
    icon: "users",
    category: "interoperability",
  },
  {
    title: "Telehealth",
    mobileTitle: "Telehealth",
    description:
      "Conduct secure remote consultations and retain the consultation context within the patient record.",
    icon: "message-circle",
    category: "clinical",
  },
  {
    title: "Consent and access control",
    mobileTitle: "Consent",
    description:
      "Patients control sharing permissions, while organisations apply role-based access to clinical information.",
    icon: "share-2",
    category: "security",
  },
  {
    title: "Audit trail",
    mobileTitle: "Audit trail",
    description:
      "Record access and important clinical actions to support accountability, security reviews, and compliance.",
    icon: "lock",
    category: "security",
  },
  {
    title: "Health insights",
    mobileTitle: "Insights",
    description:
      "Visualise laboratory values, vital signs, and care activity over time to support informed follow-up.",
    icon: "bar-chart",
    category: "analytics",
  },
  {
    title: "AI-assisted workflows",
    mobileTitle: "AI support",
    description:
      "AI can help summarise information and answer general questions; clinicians retain responsibility for medical decisions.",
    icon: "sparkles",
    category: "clinical",
  },
];

export interface ImedicsBenefit {
  title: string;
  description: string;
}

export const IMEDICS_BENEFITS: readonly ImedicsBenefit[] = [
  {
    title: "One central case file",
    description:
      "Consultations, results, prescriptions, imaging, and documents are connected in a single patient record rather than scattered across systems.",
  },
  {
    title: "Verified doctors and facilities",
    description:
      "Hospitals, laboratories, diagnostic centres, and pharmacies are verified organisations; clinician credentials are checked during registration.",
  },
  {
    title: "Results you can follow",
    description:
      "Laboratory and diagnostic results appear in your account once verified, with reference ranges, trends, and clinician interpretation where available.",
  },
  {
    title: "Safer medication information",
    description:
      "A clear medication and allergy list helps patients and clinicians maintain an accurate picture for prescribing and care decisions.",
  },
  {
    title: "Security by design",
    description:
      "Role-based access, encrypted storage, consent controls, and audit trails help ensure records are visible only to authorised people.",
  },
  {
    title: "Care that travels with you",
    description:
      "Share selected information with a doctor, laboratory, diagnostic centre, or pharmacy—without repeating your history at every visit.",
  },
  {
    title: "AI-assisted, clinician-led",
    description:
      "AI supports information discovery and workflow efficiency, while diagnosis and treatment remain with qualified professionals.",
  },
  {
    title: "Built for every organisation",
    description:
      "From an independent practice to a multi-department hospital, each facility can configure its teams, workflows, and permissions.",
  },
];

export const IMEDICS_CONTACT = {
  heading: "Contact and support",
  description:
    "Questions about your account, booking, record access, or listing a facility? Our support team replies within one business day.",
  email: "support@medic1905.com",
  emergency: {
    text: "In an emergency, call your local emergency number immediately.",
    cta: "Emergency & CPR guides",
    href: "/emergency",
  },
} as const;

export const IMEDICS_IMAGE_CREDITS: readonly string[] = [
  "Video consultation photographs by Shixart1985, CC BY 2.0, via Wikimedia Commons",
  "Doctor workspace photograph by Shixart1985, CC BY 2.0, via Wikimedia Commons",
  "Laboratory photograph by Goleisureintl, CC BY-SA 4.0, via Wikimedia Commons",
  "Diagnostic imaging photograph by Goleisureintl, CC BY-SA 4.0, via Wikimedia Commons",
];
