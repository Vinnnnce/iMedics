import type { AccountType } from "@prisma/client";

/**
 * Account-specific suggestions shown on each dashboard and on the public
 * homepage. Builders are pure functions of the dashboard state the page
 * already loads, so they stay testable and never fetch data themselves.
 */

export interface Suggestion {
  title: string;
  description: string;
  href: string;
  cta: string;
}

/** Never show more than this many suggestions at once. */
const MAX_SUGGESTIONS = 4;

function cap(items: Suggestion[]): Suggestion[] {
  return items.slice(0, MAX_SUGGESTIONS);
}

export interface PatientSuggestionState {
  hasUpcomingAppointment: boolean;
  unpaidPayments: number;
  failedPayments: number;
  pendingResults: number;
  unreadMessages: number;
  hasBloodGroup: boolean;
}

/** Suggestions for the patient dashboard. */
export function patientSuggestions(state: PatientSuggestionState): Suggestion[] {
  const items: Suggestion[] = [];

  if (!state.hasUpcomingAppointment) {
    items.push({
      title: "Book a consultation",
      description: "You have no upcoming appointment. Find a verified doctor and book a slot.",
      href: "/doctors",
      cta: "Find a doctor",
    });
  }
  if (state.unpaidPayments > 0 || state.failedPayments > 0) {
    items.push({
      title: "Complete your payment",
      description: `${state.unpaidPayments + state.failedPayments} ${
        state.unpaidPayments + state.failedPayments === 1 ? "booking needs" : "bookings need"
      } payment before the appointment is held.`,
      href: "/payments",
      cta: "Pay now",
    });
  }
  if (state.pendingResults > 0) {
    items.push({
      title: "Track your pending results",
      description: `${state.pendingResults} ${
        state.pendingResults === 1 ? "test or report is" : "tests and reports are"
      } being processed or awaiting release.`,
      href: "/patient/results",
      cta: "View status",
    });
  }
  if (state.unreadMessages > 0) {
    items.push({
      title: "Read messages from your care team",
      description: `You have ${state.unreadMessages} unread ${
        state.unreadMessages === 1 ? "message" : "messages"
      } from your doctors or facilities.`,
      href: "/patient/consult",
      cta: "Open messages",
    });
  }
  if (!state.hasBloodGroup) {
    items.push({
      title: "Complete your health summary",
      description: "Add your blood group and medical details so doctors can treat you faster.",
      href: "/patient/case-file",
      cta: "Update case file",
    });
  }
  if (items.length < 3) {
    items.push({
      title: "Find a laboratory or diagnostic centre",
      description: "Book laboratory tests and scans with verified facilities near you.",
      href: "/facilities",
      cta: "Browse facilities",
    });
  }

  return cap(items);
}

export interface DoctorSuggestionState {
  pendingBookings: number;
  aiToReview: number;
  subscriptionActive: boolean;
  activePatients: number;
}

/** Suggestions for the doctor dashboard. */
export function doctorSuggestions(state: DoctorSuggestionState): Suggestion[] {
  const items: Suggestion[] = [];

  if (state.pendingBookings > 0) {
    items.push({
      title: "Respond to booking requests",
      description: `${state.pendingBookings} ${
        state.pendingBookings === 1 ? "patient is" : "patients are"
      } waiting for you to confirm or decline a booking.`,
      href: "/doctor/booking-requests",
      cta: "Review requests",
    });
  }
  if (state.aiToReview > 0) {
    items.push({
      title: "Review AI result explanations",
      description: `${state.aiToReview} ${
        state.aiToReview === 1 ? "draft needs" : "drafts need"
      } your review before patients can see them.`,
      href: "/doctor/ai-tools",
      cta: "Open AI tools",
    });
  }
  if (!state.subscriptionActive) {
    items.push({
      title: "Activate your subscription",
      description: "Feature access, including AI tools, depends on an active plan.",
      href: "/doctor/subscription",
      cta: "Manage plan",
    });
  }
  if (items.length < 3) {
    items.push({
      title: state.activePatients > 0 ? "Publish or update your services" : "Publish your first service",
      description: "Patients book you through your service catalogue and weekly availability.",
      href: "/doctor/services",
      cta: "Manage services",
    });
  }
  if (items.length < 3) {
    items.push({
      title: "Keep your weekly availability current",
      description: "Your published slots are what patients can book.",
      href: "/doctor/schedule",
      cta: "Edit schedule",
    });
  }

  return cap(items);
}

export interface FacilitySuggestionState {
  accountType: AccountType | null | undefined;
  referralInbox: number;
  credentialAlerts: number;
  activeServices: number;
}

/** Suggestions for the facility (hospital / laboratory / diagnostic centre) dashboard. */
export function facilitySuggestions(state: FacilitySuggestionState): Suggestion[] {
  const items: Suggestion[] = [];

  if (state.referralInbox > 0) {
    items.push({
      title: "Accept pending referrals",
      description: `${state.referralInbox} ${
        state.referralInbox === 1 ? "referral is" : "referrals are"
      } waiting from Medic1905 doctors.`,
      href: "/lab/referrals",
      cta: "Open referrals",
    });
  }
  if (state.credentialAlerts > 0) {
    items.push({
      title: "Resolve credential alerts",
      description: `${state.credentialAlerts} ${
        state.credentialAlerts === 1 ? "credential expires soon or has" : "credentials expire soon or have"
      } expired.`,
      href: "/lab/credentials",
      cta: "Review credentials",
    });
  }
  if (state.activeServices === 0) {
    items.push({
      title: "Publish your service catalogue",
      description: "Doctors and patients can only order the services you list.",
      href: "/lab/services",
      cta: "Add services",
    });
  }

  // One suggestion specific to the facility's account type.
  switch (state.accountType) {
    case "HOSPITAL":
      items.push({
        title: "Invite and manage staff",
        description: "Assign roles so the right people can see and manage patient data.",
        href: "/lab/staff",
        cta: "Manage staff",
      });
      break;
    case "LABORATORY":
      items.push({
        title: "Track incoming orders",
        description: "Follow orders from check-in to verified release.",
        href: "/lab/orders",
        cta: "Open orders",
      });
      break;
    case "DIAGNOSTIC_CENTRE":
      items.push({
        title: "Manage booking workflows",
        description: "Track investigations from check-in to released reports.",
        href: "/lab/bookings",
        cta: "Open bookings",
      });
      break;
    case "PHARMACY":
      items.push({
        title: "Work the medication queue",
        description: "Review, dispense and track medication orders from submission to completion.",
        href: "/lab/pharmacy",
        cta: "Open pharmacy",
      });
      break;
    default:
      break;
  }

  if (items.length < 3) {
    items.push({
      title: "Complete your facility profile",
      description: "A complete profile helps patients and referring doctors find and trust you.",
      href: "/lab/me",
      cta: "Edit profile",
    });
  }

  return cap(items);
}

/** Suggestions for the public homepage (signed-out visitors). */
export const HOMEPAGE_SUGGESTIONS: Suggestion[] = [
  {
    title: "Find a doctor",
    description: "Search verified doctors by specialty and book a video, chat or in-person consultation.",
    href: "/doctors",
    cta: "Browse doctors",
  },
  {
    title: "Find a laboratory or diagnostic centre",
    description: "Order laboratory tests and scans from verified facilities, with results in your case file.",
    href: "/laboratories",
    cta: "Browse facilities",
  },
  {
    title: "Join as a provider",
    description: "Register as a doctor, hospital, laboratory or diagnostic centre and reach patients.",
    href: "/auth/signup",
    cta: "Create an account",
  },
];
