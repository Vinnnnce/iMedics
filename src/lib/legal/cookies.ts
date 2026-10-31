import type { AudienceSection, PolicySection } from "./types";
import { LEGAL_META } from "./types";

/**
 * Cookie Policy content for Nigerian healthcare compliance.
 * Practices follow what the codebase actually uses; the policy is honest
 * about what is NOT collected (no third-party analytics/advertising cookies).
 */

export const COOKIES_COMMON: PolicySection[] = [
  {
    id: "what-cookies-are",
    heading: "1. What cookies and similar technologies are",
    paragraphs: [
      "Cookies are small files that a website places on your device so it can remember you between visits. We and our infrastructure providers also use similar browser storage (for example, local storage holding your session, theme and push-notification subscriptions). In this policy, 'cookies' means all of these.",
    ],
  },
  {
    id: "how-we-use-cookies",
    heading: "2. How this platform uses cookies",
    paragraphs: [
      "We use cookies only where they are necessary for the Service to work, plus a small number of preference cookies. Under the Nigeria Data Protection Act 2023, cookies that are not strictly necessary require your consent. Specifically, we use:",
    ],
    bullets: [
      "Strictly necessary cookies — sign-in session and security tokens from our authentication provider (for example, session and sign-out states). Without these, you cannot sign in or use your account. No consent is needed because the Service cannot function without them.",
      "Preference storage — for example, remembering your light or dark theme choice. It is kept on your device only and you can clear it in your browser at any time.",
      "Push and notification subscriptions — stored locally so security alerts, appointment and result notifications can reach you. You can turn these off in your device or account notification settings.",
      "During payment, the licensed payment gateway (Paystack) may use cookies to protect the checkout against fraud. These are strictly necessary for processing your payment.",
    ],
    note: "We do not use advertising cookies, cross-site trackers, or third-party analytics cookies. We do not build advertising profiles from your health data.",
  },
  {
    id: "managing-cookies",
    heading: "3. Managing cookies",
    paragraphs: [
      "You can control cookies through your browser settings: you can block all cookies, delete existing ones, or ask to be warned before they are set. Blocking strictly necessary cookies will prevent sign-in and may break parts of the Service. You can manage notification preferences inside the Service (Settings → Notifications) without touching your browser.",
    ],
  },
  {
    id: "your-rights",
    heading: "4. Your rights and contact",
    paragraphs: [
      `Cookies involve processing of your personal data, so your NDPA 2023 rights apply (see our Privacy Policy). If you have questions about cookies, contact ${LEGAL_META.contactEmail}. You may also complain to the Nigeria Data Protection Commission.`,
    ],
  },
];

export const COOKIES_AUDIENCES: AudienceSection[] = [
  {
    audience: "PATIENT",
    sections: [
      {
        id: "patient-cookies",
        heading: "For patients",
        paragraphs: [
          "Cookies keep you signed in, remember your preferences, and let appointment and result notifications reach you. Blocking them signs you out of the app.",
        ],
      },
    ],
  },
  {
    audience: "DOCTOR",
    sections: [
      {
        id: "doctor-cookies",
        heading: "For doctors",
        paragraphs: [
          "The same session and preference cookies apply to your doctor account. Push notifications for new appointments and patient messages rely on your browser or device subscription, which you can revoke at any time.",
        ],
      },
    ],
  },
  {
    audience: "HOSPITAL",
    sections: [
      {
        id: "hospital-cookies",
        heading: "For hospitals",
        paragraphs: [
          "Facility accounts use the same session cookies to keep staff signed in to the facility workspace. Access is controlled by the staff roles your managers assign, not by cookies. Facility staff should sign out of shared computers when finished.",
        ],
      },
    ],
  },
  {
    audience: "LABORATORY",
    sections: [
      {
        id: "laboratory-cookies",
        heading: "For laboratories",
        paragraphs: [
          "Session cookies keep laboratory staff signed in to the results workflow. Cookies never grant access to patient data by themselves — access depends on your staff roles and permissions. Always sign out of shared laboratory computers.",
        ],
      },
    ],
  },
  {
    audience: "DIAGNOSTIC_CENTRE",
    sections: [
      {
        id: "diagnostic-centre-cookies",
        heading: "For diagnostic centres",
        paragraphs: [
          "Session cookies keep diagnostic centre staff signed in to the reporting workflow. Access to patient data is controlled by staff roles, not cookies. Sign out of shared workstations when finished.",
        ],
      },
    ],
  },
  {
    audience: "PHARMACY",
    sections: [
      {
        id: "pharmacy-cookies",
        heading: "For pharmacies",
        paragraphs: [
          "Session cookies keep pharmacy staff signed in to the dispensing workflow. Access to patient data is controlled by staff roles, not cookies. Sign out of shared workstations when finished.",
        ],
      },
    ],
  },
];
