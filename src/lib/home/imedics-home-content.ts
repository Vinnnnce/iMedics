/**
 * Medic1905 public homepage content. Pure data so it can be unit-tested and
 * reused by the landing page and its footer without duplication.
 *
 * Every card targets a real route in this application (enforced in
 * imedics-home-content.test.ts). Features that are not implemented are
 * omitted rather than advertised, and each card states honestly whether an
 * account is needed.
 */

export type ImedicsServiceAccess = "account" | "public";

export interface ImedicsServiceCard {
  title: string;
  description: string;
  href: string;
  /** Lucide icon name, resolved by the homepage component. */
  icon:
    | "stethoscope"
    | "message-circle"
    | "calendar"
    | "flask"
    | "folder"
    | "file-text"
    | "heart-pulse"
    | "sparkles";
  access: ImedicsServiceAccess;
}

export const IMEDICS_SERVICE_CARDS: readonly ImedicsServiceCard[] = [
  {
    title: "Find a Doctor",
    description: "Browse verified doctors by specialty and book a visit.",
    href: "/doctors",
    icon: "stethoscope",
    access: "account",
  },
  {
    title: "Consultations",
    description: "Secure chat consultations with your doctor.",
    href: "/patient/consult",
    icon: "message-circle",
    access: "account",
  },
  {
    title: "Appointments",
    description: "Manage your bookings, visits, and reminders.",
    href: "/patient/appointments",
    icon: "calendar",
    access: "account",
  },
  {
    title: "Lab Tests & Results",
    description: "View your laboratory test results as they arrive.",
    href: "/patient/results",
    icon: "flask",
    access: "account",
  },
  {
    title: "Health Records",
    description: "Your case file and history, stored securely.",
    href: "/patient/records",
    icon: "folder",
    access: "account",
  },
  {
    title: "Prescriptions",
    description: "View and print prescriptions issued by your doctors.",
    href: "/patient/prescriptions",
    icon: "file-text",
    access: "account",
  },
  {
    title: "Emergency & CPR",
    description: "Life-saving guides and emergency numbers.",
    href: "/emergency",
    icon: "heart-pulse",
    access: "public",
  },
  {
    title: "AI Health Assistant",
    description: "Ask health questions and get informational guidance.",
    href: "/ai-assistant",
    icon: "sparkles",
    access: "account",
  },
];

export interface ImedicsHomeSlide {
  id: string;
  title: string;
  description: string;
  /** Optional destination the slide promotes (real route only). */
  ctaHref?: string;
  ctaLabel?: string;
  /** Lucide icon name shown on the slide. */
  icon: "stethoscope" | "heart-pulse" | "flask" | "sparkles" | "calendar" | "folder";
  /** Optional image URL; rendered in monochrome (grayscale) when present. */
  image?: string;
}

/** Add a new slide by appending an entry here — the carousel adapts. */
export const IMEDICS_HOME_SLIDES: readonly ImedicsHomeSlide[] = [
  {
    id: "find-doctor",
    title: "Find a verified doctor",
    description: "Browse doctors by specialty and book a visit that fits your schedule.",
    ctaHref: "/doctors",
    ctaLabel: "Browse doctors",
    icon: "stethoscope",
  },
  {
    id: "lab-results",
    title: "Lab results in one place",
    description: "Laboratory results arrive in your account as soon as they are verified.",
    ctaHref: "/patient/results",
    ctaLabel: "See lab results",
    icon: "flask",
  },
  {
    id: "emergency",
    title: "Emergency & CPR guides",
    description: "Life-saving steps and emergency numbers, available without an account.",
    ctaHref: "/emergency",
    ctaLabel: "Open guides",
    icon: "heart-pulse",
  },
  {
    id: "ai-assistant",
    title: "AI health assistant",
    description: "Ask health questions and get clear, informational answers any time.",
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

/** The single ad banner on the homepage. Falls back to this default whenever
 * no HOMEPAGE_BANNER ad is active in the admin content manager. */
export const IMEDICS_SINGLE_AD_BANNER: ImedicsAdBanner = {
  title: "Medic1905 for organizations",
  content: "Hospitals, laboratories and diagnostic centres manage referrals, results and imaging in one verified workspace.",
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
      "Medic1905 is a healthcare platform that connects you with verified doctors, hospitals, laboratories and diagnostic centres. You can find a provider, book consultations, order lab tests, and manage a secure health record — all in one place.",
  },
  {
    question: "Do I need an account?",
    answer:
      "Browsing the hospital and laboratory directories and reading the emergency guides is open to everyone. Consulting a doctor, booking appointments, and managing your records requires a free account.",
  },
  {
    question: "Is my health data secure?",
    answer:
      "Yes. Records are stored securely, access is controlled by you, and sharing permissions stay in your hands. Doctors only see what you allow them to see.",
  },
  {
    question: "Is Medic1905 a medical provider?",
    answer:
      "No. Medic1905 is a platform: doctors and facilities remain responsible for clinical decisions, and AI-assisted content is informational, not medical advice.",
  },
];

export const IMEDICS_HOW_IT_WORKS_STEPS: readonly string[] = [
  "Create a free account with your email",
  "Find a verified doctor, hospital, or laboratory",
  "Book a time and pay securely",
  "Receive your results, prescriptions, and follow-ups",
];

export const IMEDICS_FEATURED_PANEL = {
  heading: "Your next step in healthcare",
  description:
    "Access Medic1905 and continue exploring the tools and medical information available to you.",
  cta: "Login",
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
      { label: "Emergency & CPR", href: "/emergency" },
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

/**
 * Landing-page navigation, following the Beeline products-page layout
 * approach: a small set of audience categories that mirror how the platform is
 * actually used. Anchors (#…) target sections on this page; every other link
 * targets a real route (validated below in the same spirit as the cards).
 */
export interface ImedicsNavLink {
  label: string;
  href: string;
  /** Hide from the compact desktop bar (still shown in the mobile menu). */
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
  { label: "Features", href: "#features" },
  { label: "Contact Us", href: "#contact" },
];

/** The six audience sections — one for each kind of Medic1905 account. */
export interface ImedicsAudience {
  key: "patients" | "doctors" | "hospitals" | "laboratories" | "diagnostics" | "pharmacies";
  title: string;
  description: string;
  cta: string;
  href: string;
  /** Image in /public/home (omitted when the card uses a designed field). */
  image?: string;
  imageAlt?: string;
}

export const IMEDICS_AUDIENCES: readonly ImedicsAudience[] = [
  {
    key: "patients",
    title: "For patients",
    description: "Find a doctor, book visits, consult securely, and follow your results, prescriptions and case file in one place.",
    cta: "Get started",
    href: "/auth/signup",
    image: "/home/patients-consultation.jpg",
    imageAlt: "A doctor speaking with a patient during an online consultation",
  },
  {
    key: "doctors",
    title: "For doctors",
    description: "A clinical workspace with your patients, consultations, AI-assisted analysis and clinical tools — independent or within a facility.",    cta: "Join as a doctor",
    href: "/auth/signup",
    image: "/home/doctors-workspace.jpg",
    imageAlt: "A health professional organising medication beside a laptop",
  },
  {
    key: "hospitals",
    title: "For hospitals",
    description: "Wards, doctors, nurses, laboratory, pharmacy, billing and administration in one hospital-grade workspace, with per-department permissions.",
    cta: "List your hospital",
    href: "/hospitals",
  },
  {
    key: "laboratories",
    title: "Laboratories",
    description: "Receive requests, record and verify results, and release them straight to the patient's case file and doctor.",
    cta: "Find a laboratory",
    href: "/laboratories",
    image: "/home/laboratory-centrifuge.jpg",
    imageAlt: "A laboratory technician loading a sample into a centrifuge",
  },
  {
    key: "diagnostics",
    title: "Diagnostic centres",
    description: "Manage diagnostic and imaging examinations, verify reports and share them securely with patients and referrers.",
    cta: "Find a centre",
    href: "/diagnostic-centres",
    image: "/home/diagnostics-radiology.jpg",
    imageAlt: "A modern diagnostic imaging suite with scanners",
  },
  {
    key: "pharmacies",
    title: "Pharmacies",
    description: "Receive prescriptions from doctors, manage your formulary and serve patients from a dedicated pharmacy workspace.",
    cta: "Find a pharmacy",
    href: "/pharmacies",
    image: "/home/pharmacy-team.jpg",
    imageAlt: "Pharmacists at work in a pharmacy",
  },
];

/** Key platform benefits — the #features section. */
export interface ImedicsBenefit {
  title: string;
  description: string;
}

export const IMEDICS_BENEFITS: readonly ImedicsBenefit[] = [
  {
    title: "One central case file",
    description: "Every consultation, result, prescription and document is stored in a single patient case file — not scattered across departments.",
  },
  {
    title: "Verified doctors and facilities",
    description: "Hospitals, laboratories, diagnostic centres and pharmacies are verified organisations; doctor credentials are checked at registration.",
  },
  {
    title: "Results you can actually follow",
    description: "Laboratory and diagnostic results appear in your account as soon as they are verified, with reference ranges and your doctor's interpretation.",
  },
  {
    title: "Security by design",
    description: "Role-based access, encrypted storage and a full audit trail: your record is only visible to the doctors you allow and the facilities treating you.",
  },
  {
    title: "AI-assisted, doctor-checked",
    description: "AI tools help with questions and analysis, while clinical decisions always remain with your doctors and facilities.",
  },
  {
    title: "For organisations of every size",
    description: "From an independent doctor's practice to a full hospital, each facility configures its own departments, staff and permissions.",
  },
];

/** Contact and support information shown in the #contact section. */
export const IMEDICS_CONTACT = {
  heading: "Contact and support",
  description:
    "Questions about your account, booking, or listing a facility? Our support team replies within one business day.",
  email: "support@medic1905.com",
  emergency: {
    text: "In an emergency, call your local emergency number immediately.",
    cta: "Emergency & CPR guides",
    href: "/emergency",
  },
} as const;

/**
 * Photography credits for the images used on the landing page (all from
 * Wikimedia Commons under free licences). Rendered small in the footer.
 */
export const IMEDICS_IMAGE_CREDITS: readonly string[] = [
  "Video consultation photographs by Shixart1985, CC BY 2.0, via Wikimedia Commons",
  "Doctor workspace photograph by Shixart1985, CC BY 2.0, via Wikimedia Commons",
  "Laboratory photograph by Goleisureintl, CC BY-SA 4.0, via Wikimedia Commons",
  "Diagnostic imaging photograph by Goleisureintl, CC BY-SA 4.0, via Wikimedia Commons",
  "Pharmacy photograph by Amy Urbina, public domain, via Wikimedia Commons",
];
