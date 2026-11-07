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
      "This implementation keeps optional preference storage off until you choose it. Essential authentication and security storage supports the service you request. The operator must confirm the final cookie inventory and applicable consent requirements under the Nigeria Data Protection Act 2023 before this draft is published. The current categories are:",
    ],
    bullets: [
      "Strictly necessary cookies — sign-in session and security tokens from our authentication provider (for example, session and sign-out states). Without these, you cannot sign in or use your account. This implementation treats them as essential; the operator must confirm the applicable legal basis.",
      "Registration tab drafts — session storage retains basic form answers while you complete account setup, excludes document files, and is cleared after successful submission. Closing the tab ends this draft storage. This requested signup function is separate from optional analytics or advertising.",
      "Preference storage — light/dark theme and sidebar layout are remembered only after preference consent. Without that consent, choices work for the current page session. Consent choices themselves are stored locally for up to 180 days to respect your decision.",
      "Analytics, performance and marketing — separate optional categories are available in Cookie settings. No analytics, advertising or performance-tracking integration is installed by this upgrade. A future integration must check its category before loading and update this inventory, vendor details, purposes and retention periods.",
      "Push and notification subscriptions — stored locally so security alerts, appointment and result notifications can reach you. You can turn these off in your device or account notification settings.",
      "During a payment you request, the payment gateway (Paystack) may use storage to protect checkout against fraud. The operator must verify its actual categories, purposes and retention in the final provider inventory.",
    ],
    note: "We do not use advertising cookies, cross-site trackers, or third-party analytics cookies. We do not build advertising profiles from your health data.",
  },
  {
    id: "managing-cookies",
    heading: "3. Managing cookies",
    paragraphs: [
      "Open Cookie settings from any page to accept all categories, reject optional categories, customise individual choices or withdraw consent. Withdrawing preference consent removes saved theme/sidebar choices without signing you out. Blocking essential authentication cookies may prevent sign-in. Notification permissions are separate and can be managed in Settings or your browser.",
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
