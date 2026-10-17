import type { NotificationType, Role } from "@prisma/client";
import { ROLE_POLICY } from "@/lib/roles";

/**
 * Every notification is described by one of these events. Templates below are the ONLY place notification text
 * is written, and they take ids, never names or clinical details. That keeps email, push and lock-screen
 * content free of private health information by construction: users open the secure app to see details.
 */
export type NotificationEvent =
  | { kind: "APPOINTMENT_REQUESTED"; appointmentId: string }
  | { kind: "APPOINTMENT_CONFIRMED"; appointmentId: string }
  | { kind: "APPOINTMENT_CANCELLED"; appointmentId: string }
  | { kind: "APPOINTMENT_RESCHEDULED"; appointmentId: string }
  | { kind: "APPOINTMENT_REMINDER"; appointmentId: string; window: "24h" | "1h" }
  | { kind: "MESSAGE_RECEIVED"; conversationId: string }
  | { kind: "PAYMENT_SUCCESSFUL"; paymentId: string }
  | { kind: "PAYMENT_FAILED"; paymentId: string }
  | { kind: "PAYMENT_REFUND_PENDING"; paymentId: string }
  | { kind: "PAYMENT_REFUNDED"; paymentId: string }
  | { kind: "REFUND_REQUESTED"; paymentId: string }
  | { kind: "REFUND_DECIDED"; paymentId: string; approved: boolean }
  | { kind: "FACILITY_BOOKING_REQUESTED"; bookingId: string }
  | { kind: "FACILITY_BOOKING_UPDATED"; bookingId: string }
  | { kind: "FACILITY_RESULT_RELEASED"; bookingId: string }
  | { kind: "FACILITY_STAFF_JOINED"; facilityId: string }
  | { kind: "FACILITY_REFERRAL_RECEIVED"; referralId: string }
  | { kind: "CREDENTIAL_EXPIRING"; credentialId: string }
  | { kind: "CREDENTIAL_EXPIRED"; credentialId: string }
  | { kind: "RESULTS_AVAILABLE"; analysisId: string }
  | { kind: "TASK_CREATED"; taskId: string }
  | { kind: "TASK_COMPLETED"; taskId: string }
  | { kind: "ACCOUNT_REGISTERED" }
  | { kind: "ACCOUNT_UPDATED" }
  | { kind: "DOCUMENT_SHARED" }
  | { kind: "INTAKE_SUBMITTED" }
  | { kind: "SUBSCRIPTION_UPDATED" }
  | { kind: "DISPUTE_UPDATED"; paymentId: string }
  | { kind: "CONSULTATION_AVAILABLE" }
  | { kind: "REVIEW_SUBMITTED"; reviewId: string }
  | { kind: "VERIFICATION_UPDATED" }
  | { kind: "SUBSCRIPTION_ACTIVATED"; subscriptionId: string }
  | { kind: "SUBSCRIPTION_RENEWED"; subscriptionId: string }
  | { kind: "SUBSCRIPTION_RENEWAL_DUE"; subscriptionId: string }
  | { kind: "SUBSCRIPTION_EXPIRED"; subscriptionId: string }
  | { kind: "SUBSCRIPTION_CANCELLED"; subscriptionId: string }
  | { kind: "PLAN_CHANGED"; subscriptionId: string }
  | { kind: "RECONCILIATION_ALERT"; runId: string; discrepancies: number }
  | { kind: "REFUND_STUCK"; paymentId: string };

export interface RenderedNotification {
  type: NotificationType;
  title: string;
  /** Short and generic: shown on lock screens and in emails. */
  body: string;
  /** Relative in-app path the notification opens. */
  href: string;
  /** Machine-readable references for deduplication and deep links. Ids only. */
  data: Record<string, string>;
}

const appointmentsHref = (role: Role) => (role === "DOCTOR" ? "/doctor/booking-requests" : "/patient/appointments");
const messagesHref = (role: Role) => (role === "DOCTOR" ? "/doctor/chat" : "/patient/consult");
const bookingsHref = (role: Role) => (role === "LAB_SCIENTIST" ? "/lab/bookings" : "/facilities/bookings");

export function renderNotification(event: NotificationEvent, role: Role): RenderedNotification {
  switch (event.kind) {
    case "DOCUMENT_SHARED":
      return { type: "SYSTEM", title: "A document was shared with you", body: "Sign in securely to review the time-limited access.", href: "/doctor/dashboard", data: {} };
    case "INTAKE_SUBMITTED":
      return { type: "APPOINTMENT", title: "Pre-visit intake updated", body: "Sign in securely to review the intake before the appointment.", href: "/doctor/dashboard", data: {} };
    case "SUBSCRIPTION_UPDATED":
      return { type: "SYSTEM", title: "Subscription updated", body: "Sign in securely to review your subscription status.", href: ROLE_POLICY[role].dashboard, data: {} };
    case "DISPUTE_UPDATED":
      return { type: "PAYMENT", title: "Payment dispute updated", body: "Sign in securely to review the outcome.", href: role === "ADMIN" ? "/admin/dashboard" : `/payments/${event.paymentId}`, data: {} };
    case "CONSULTATION_AVAILABLE":
      return { type: "SYSTEM", title: "Consultation record available", body: "Your clinician has finalized a consultation record. Sign in securely to review it.", href: "/patient/case-file", data: {} };
    case "REVIEW_SUBMITTED":
      return { type: "SYSTEM", title: "New patient review", body: "A patient reviewed a recent consultation. Sign in to read it.", href: "/doctor/dashboard", data: {} };
    case "VERIFICATION_UPDATED":
      return { type: "SYSTEM", title: "Verification status updated", body: "There is an update to your professional verification. Sign in to review it.", href: ROLE_POLICY[role].dashboard, data: {} };
    case "ACCOUNT_REGISTERED":
    case "ACCOUNT_UPDATED":
      return { type: "SYSTEM", title: event.kind === "ACCOUNT_REGISTERED" ? "Your account is ready" : "Account updated",
        body: "There is an update to your account. Sign in securely to review it.",
        href: ROLE_POLICY[role].dashboard, data: {} };
    case "TASK_CREATED":
    case "TASK_COMPLETED":
      return { type: "SYSTEM", title: event.kind === "TASK_CREATED" ? "New care task" : "Task completed",
        body: "Your task list has been updated. Sign in securely to review it.",
        href: "/workspace", data: { taskId: event.taskId } };
    case "APPOINTMENT_REQUESTED":
      return {
        type: "APPOINTMENT",
        title: "New booking request",
        body: "You have a new appointment request. Sign in to review it.",
        href: appointmentsHref(role),
        data: { appointmentId: event.appointmentId },
      };
    case "APPOINTMENT_CONFIRMED":
      return {
        type: "APPOINTMENT",
        title: "Appointment confirmed",
        body: "Your appointment has been confirmed. Sign in to see the details.",
        href: appointmentsHref(role),
        data: { appointmentId: event.appointmentId },
      };
    case "APPOINTMENT_CANCELLED":
      return {
        type: "APPOINTMENT",
        title: "Appointment cancelled",
        body: "An appointment was cancelled. Sign in to see the details.",
        href: appointmentsHref(role),
        data: { appointmentId: event.appointmentId },
      };
    case "APPOINTMENT_RESCHEDULED":
      return {
        type: "APPOINTMENT",
        title: "Appointment rescheduled",
        body: "An appointment time has changed. Sign in to see the new time.",
        href: appointmentsHref(role),
        data: { appointmentId: event.appointmentId },
      };
    case "APPOINTMENT_REMINDER":
      return {
        type: "APPOINTMENT",
        title: event.window === "1h" ? "Appointment starting soon" : "Appointment reminder",
        body:
          event.window === "1h"
            ? "You have an appointment within the next hour."
            : "You have an appointment coming up tomorrow.",
        href: appointmentsHref(role),
        data: { appointmentId: event.appointmentId, reminder: event.window },
      };
    case "MESSAGE_RECEIVED":
      return {
        type: "MESSAGE",
        title: "New message",
        body: "You have a new message. Sign in to read it.",
        href: messagesHref(role),
        data: { conversationId: event.conversationId },
      };
    case "PAYMENT_SUCCESSFUL":
      return {
        type: "PAYMENT",
        title: "Payment successful",
        body: "Your payment was received. Your receipt is available in your account.",
        href: `/payments/${event.paymentId}`,
        data: { paymentId: event.paymentId },
      };
    case "PAYMENT_FAILED":
      return {
        type: "PAYMENT",
        title: "Payment failed",
        body: "Your payment did not go through. You can try again from your account.",
        href: `/payments/${event.paymentId}`,
        data: { paymentId: event.paymentId },
      };
    case "PAYMENT_REFUND_PENDING":
      return {
        type: "PAYMENT",
        title: "Refund in progress",
        body: "A refund has been started. It can take a few days to reach your account.",
        href: `/payments/${event.paymentId}`,
        data: { paymentId: event.paymentId },
      };
    case "REFUND_REQUESTED":
      return {
        type: "PAYMENT",
        title: "Refund requested",
        body: "A refund request has been received and is awaiting review.",
        href: `/payments/${event.paymentId}`,
        data: { paymentId: event.paymentId },
      };
    case "REFUND_DECIDED":
      return {
        type: "PAYMENT",
        title: event.approved ? "Refund approved" : "Refund declined",
        body: event.approved
          ? "Your refund has been approved and will be processed shortly."
          : "Your refund request was not approved. Sign in for details.",
        href: `/payments/${event.paymentId}`,
        data: { paymentId: event.paymentId },
      };
    case "PAYMENT_REFUNDED":
      return {
        type: "PAYMENT",
        title: "Refund completed",
        body: "Your refund has been processed.",
        href: `/payments/${event.paymentId}`,
        data: { paymentId: event.paymentId },
      };
    case "FACILITY_BOOKING_REQUESTED":
      return {
        type: "APPOINTMENT",
        title: "New service booking",
        body: "You have a new service booking. Sign in to review it.",
        href: bookingsHref(role),
        data: { bookingId: event.bookingId },
      };
    case "FACILITY_BOOKING_UPDATED":
      return {
        type: "APPOINTMENT",
        title: "Service booking updated",
        body: "A service booking has been updated. Sign in to see the details.",
        href: bookingsHref(role),
        data: { bookingId: event.bookingId },
      };
    case "FACILITY_RESULT_RELEASED":
      return {
        type: "LAB_RESULT",
        title: "Your result is ready",
        body: "A result from your facility booking is ready. Sign in to view it.",
        href: role === "PATIENT" ? "/patient/results" : "/lab/bookings",
        data: { bookingId: event.bookingId },
      };
    case "FACILITY_STAFF_JOINED":
      return {
        type: "SYSTEM",
        title: "Staff member joined",
        body: "An invited staff member has joined your facility.",
        href: "/lab/staff",
        data: { facilityId: event.facilityId },
      };
    case "FACILITY_REFERRAL_RECEIVED":
      return {
        type: "SYSTEM",
        title: "New referral received",
        body: "A Medic1905 doctor has referred a patient to your facility. Sign in to review it.",
        href: "/lab/referrals",
        data: { referralId: event.referralId },
      };
    case "CREDENTIAL_EXPIRING":
      return {
        type: "SYSTEM",
        title: "Credential expiring soon",
        body: "A staff credential expires soon. Sign in to review the renewal.",
        href: "/lab/credentials",
        data: { credentialId: event.credentialId },
      };
    case "CREDENTIAL_EXPIRED":
      return {
        type: "SYSTEM",
        title: "Credential expired",
        body: "A staff credential has expired. Sign in to review it.",
        href: "/lab/credentials",
        data: { credentialId: event.credentialId },
      };
    case "RESULTS_AVAILABLE":
      return {
        type: "LAB_RESULT",
        title: "New results available",
        body: "New information is available in your account.",
        href: role === "PATIENT" ? "/patient/results" : "/",
        data: { analysisId: event.analysisId },
      };
    case "SUBSCRIPTION_ACTIVATED":
      return {
        type: "SUBSCRIPTION",
        title: "Subscription active",
        body: "Your plan is active. Sign in to manage your subscription.",
        href: "/doctor/subscription",
        data: { subscriptionId: event.subscriptionId },
      };
    case "SUBSCRIPTION_RENEWED":
      return {
        type: "SUBSCRIPTION",
        title: "Subscription renewed",
        body: "Your plan has been renewed for another month.",
        href: "/doctor/subscription",
        data: { subscriptionId: event.subscriptionId },
      };
    case "SUBSCRIPTION_RENEWAL_DUE":
      return {
        type: "SUBSCRIPTION",
        title: "Subscription renewal due",
        body: "Your plan renews soon. Sign in to review or change it.",
        href: "/doctor/subscription",
        data: { subscriptionId: event.subscriptionId },
      };
    case "SUBSCRIPTION_EXPIRED":
      return {
        type: "SUBSCRIPTION",
        title: "Subscription expired",
        body: "Your plan has expired. Sign in to renew and keep your features.",
        href: "/doctor/subscription",
        data: { subscriptionId: event.subscriptionId },
      };
    case "SUBSCRIPTION_CANCELLED":
      return {
        type: "SUBSCRIPTION",
        title: "Subscription cancelled",
        body: "Your plan will not renew. You keep access until the end of the period.",
        href: "/doctor/subscription",
        data: { subscriptionId: event.subscriptionId },
      };
    case "PLAN_CHANGED":
      return {
        type: "SUBSCRIPTION",
        title: "Plan changed",
        body: "Your subscription plan has changed. Sign in to see the details.",
        href: "/doctor/subscription",
        data: { subscriptionId: event.subscriptionId },
      };
    case "RECONCILIATION_ALERT":
      return {
        type: "SYSTEM",
        title: "Payment reconciliation alert",
        body: `${event.discrepancies} payment difference(s) were found and need review.`,
        href: "/admin/reconciliation",
        data: { runId: event.runId },
      };
    case "REFUND_STUCK":
      return {
        type: "PAYMENT",
        title: "Refund needs attention",
        body: "A refund was accepted by the gateway but has not completed. Check its status in the gateway dashboard.",
        href: `/admin/refunds`,
        data: { paymentId: event.paymentId },
      };
  }
}
