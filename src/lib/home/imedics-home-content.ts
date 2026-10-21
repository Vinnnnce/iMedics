/**
 * i-Medics public homepage content. Pure data so it can be unit-tested and
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

export interface ImedicsFaqItem {
  question: string;
  answer: string;
}

export const IMEDICS_FAQS: readonly ImedicsFaqItem[] = [
  {
    question: "What is i-Medics?",
    answer:
      "i-Medics is a healthcare platform that connects you with verified doctors, hospitals, laboratories and diagnostic centres. You can find a provider, book consultations, order lab tests, and manage a secure health record — all in one place.",
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
    question: "Is i-Medics a medical provider?",
    answer:
      "No. i-Medics is a platform: doctors and facilities remain responsible for clinical decisions, and AI-assisted content is informational, not medical advice.",
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
    "Access i-Medics and continue exploring the tools and medical information available to you.",
  cta: "Open i-Medics",
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
