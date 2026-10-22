import type { NotificationType, Role } from "@prisma/client";

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
  | { kind: "REFUND_STUCK"; paymentId: string }
  | { kind: "VERIFICATION_SUBMITTED"; applicantId: string; resubmitted: boolean }
  | { kind: "VERIFICATION_APPROVED" }
  | { kind: "VERIFICATION_REJECTED" }
  | { kind: "ACCOUNT_SUSPENDED" }
  | { kind: "ACCOUNT_RESTORED" }
  | { kind: "MEDICATION_REMINDER"; reminderId: string; doseEventId: string }
  | { kind: "WELFARE_ALERT"; alertId: string }
  | { kind: "WELFARE_ALERT_ACKNOWLEDGED"; alertId: string }
  | { kind: "DOCUMENT_SHARE_GRANTED"; documentId: string }
  | { kind: "PREVENTIVE_CARE_DUE"; taskId: string }
  | { kind: "CRITICAL_RESULT_ALERTED"; alertId: string; orderId: string }
  | { kind: "CRITICAL_ALERT_ACKNOWLEDGED"; alertId: string }
  | { kind: "INVESTIGATION_UPDATED"; orderId: string }
  | { kind: "DIAGNOSTIC_REPORT_READY"; bookingId: string };

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
    case "MEDICATION_REMINDER":
      // Deliberately generic: no medication names on lock screens or in email.
      return { type: "MEDICATION_REMINDER", title: "Medication reminder", body: "You have a medication reminder due. Open the app to confirm your dose.", href: "/patient/reminders", data: { reminderId: event.reminderId, doseEventId: event.doseEventId } };
    case "WELFARE_ALERT":
      // Sent to trusted contacts: states the patient has not checked in, nothing clinical.
      return { type: "WELFARE_ALERT", title: "Welfare check alert", body: "A patient you look after has not checked in on the platform within the period they configured. Please follow the agreed welfare-check procedure.", href: `/welfare/${event.alertId}`, data: { alertId: event.alertId } };
    case "WELFARE_ALERT_ACKNOWLEDGED":
      return { type: "WELFARE_ALERT", title: "Welfare alert acknowledged", body: "The welfare alert has been acknowledged. No further action is needed unless you agreed otherwise.", href: `/welfare/${event.alertId}`, data: { alertId: event.alertId } };
    case "DOCUMENT_SHARE_GRANTED":
      return { type: "DOCUMENT_SHARE", title: "A document was shared with you", body: "A patient shared a medical document with you. Sign in to view it.", href: "/doctor/records", data: { documentId: event.documentId } };
    case "PREVENTIVE_CARE_DUE":
      return { type: "SYSTEM", title: "Preventive care reminder", body: "A preventive-care check is due. Sign in to review it.", href: "/dashboard", data: { taskId: event.taskId } };
    case "DOCUMENT_SHARED":
      return { type: "SYSTEM", title: "A document was shared with you", body: "Sign in securely to review the time-limited access.", href: "/doctor/dashboard", data: {} };
    case "INTAKE_SUBMITTED":
      return { type: "APPOINTMENT", title: "Pre-visit intake updated", body: "Sign in securely to review the intake before the appointment.", href: "/doctor/dashboard", data: {} };
    case "SUBSCRIPTION_UPDATED":
      return { type: "SYSTEM", title: "Subscription updated", body: "Your subscription details have changed. Sign in to review them.", href: "/doctor/subscription", data: {} };
    case "DISPUTE_UPDATED":
      return { type: "PAYMENT", title: "Payment dispute updated", body: "There is an update about a payment dispute. Sign in to review it.", href: `/payments/${event.paymentId}`, data: { paymentId: event.paymentId } };
    case "CONSULTATION_AVAILABLE":
      return { type: "APPOINTMENT", title: "Consultation available", body: "A consultation update is available in your account.", href: "/doctor/consultations", data: {} };
    case "REVIEW_SUBMITTED":
      return { type: "SYSTEM", title: "New review received", body: "A patient has left a review. Sign in to read it.", href: "/doctor/dashboard", data: { reviewId: event.reviewId } };
    case "VERIFICATION_UPDATED":
      return { type: "SYSTEM", title: "Verification updated", body: "Your professional verification status has changed.", href: "/auth/callback", data: {} };
    case "ACCOUNT_REGISTERED":
      return { type: "SYSTEM", title: "Welcome to Medic1905", body: "Your account is ready. Sign in to continue.", href: "/profile", data: {} };
    case "ACCOUNT_UPDATED":
      return { type: "SYSTEM", title: "Account updated", body: "Your account status has changed. Sign in to review the update.", href: "/profile", data: {} };
    case "TASK_CREATED":
    case "TASK_COMPLETED":
      return { type: "SYSTEM", title: event.kind === "TASK_CREATED" ? "New care task" : "Task completed", body: "There is an update to a care task in your account.", href: "/workspace", data: { taskId: event.taskId } };
    case "REFUND_REQUESTED":
      return { type: "PAYMENT", title: "Refund requested", body: "A refund request is waiting for review.", href: `/payments/${event.paymentId}`, data: { paymentId: event.paymentId } };
    case "REFUND_DECIDED":
      return { type: "PAYMENT", title: event.approved ? "Refund approved" : "Refund request declined", body: event.approved ? "Your refund is being processed." : "Your refund request was declined.", href: `/payments/${event.paymentId}`, data: { paymentId: event.paymentId } };
    case "FACILITY_RESULT_RELEASED":
      return { type: "LAB_RESULT", title: "Facility result released", body: "A result is available in your account.", href: "/patient/results", data: { bookingId: event.bookingId } };
    case "FACILITY_STAFF_JOINED":
      return { type: "SYSTEM", title: "Facility team updated", body: "A new staff member joined your facility.", href: "/lab/staff", data: { facilityId: event.facilityId } };
    case "FACILITY_REFERRAL_RECEIVED":
      return { type: "APPOINTMENT", title: "New facility referral", body: "A referral is waiting for review.", href: "/lab/referrals", data: { referralId: event.referralId } };
    case "CREDENTIAL_EXPIRING":
    case "CREDENTIAL_EXPIRED":
      return { type: "SYSTEM", title: event.kind === "CREDENTIAL_EXPIRING" ? "Credential expiring soon" : "Credential expired", body: "A staff credential needs attention. Sign in to review it.", href: "/lab/credentials", data: { credentialId: event.credentialId } };
    case "SUBSCRIPTION_ACTIVATED":
    case "SUBSCRIPTION_RENEWED":
    case "SUBSCRIPTION_RENEWAL_DUE":
    case "SUBSCRIPTION_EXPIRED":
    case "SUBSCRIPTION_CANCELLED":
    case "PLAN_CHANGED":
      return { type: "SYSTEM", title: event.kind.replaceAll("_", " ").toLowerCase(), body: "There is an update to your subscription. Sign in to review it.", href: "/doctor/subscription", data: { subscriptionId: event.subscriptionId } };
    case "RECONCILIATION_ALERT":
      return { type: "SYSTEM", title: "Payment reconciliation needs review", body: "An administrator should review the latest payment reconciliation.", href: "/admin/reconciliation", data: { runId: event.runId, discrepancies: String(event.discrepancies) } };
    case "REFUND_STUCK":
      return { type: "SYSTEM", title: "Refund needs review", body: "An administrator should review a refund that has not completed.", href: "/admin/refunds", data: { paymentId: event.paymentId } };
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
    case "RESULTS_AVAILABLE":
      return {
        type: "LAB_RESULT",
        title: "New results available",
        body: "New information is available in your account.",
        href: role === "PATIENT" ? "/patient/results" : "/",
        data: { analysisId: event.analysisId },
      };
    case "VERIFICATION_SUBMITTED":
      return {
        type: "SYSTEM",
        title: event.resubmitted ? "Application resubmitted" : "New verification request",
        body: "A professional application is waiting for review.",
        href: `/admin/verifications/${event.applicantId}`,
        data: { applicantId: event.applicantId },
      };
    case "VERIFICATION_APPROVED":
      return {
        type: "SYSTEM",
        title: "Your account has been verified",
        body: "You can now sign in and start using your professional account.",
        href: role === "LAB_SCIENTIST" ? "/lab/dashboard" : role === "DOCTOR" ? "/doctor/dashboard" : "/",
        data: {},
      };
    case "VERIFICATION_REJECTED":
      return {
        type: "SYSTEM",
        title: "Your application needs attention",
        body: "We could not verify your application yet. Sign in to see what to update.",
        href: "/auth/callback",
        data: {},
      };
    case "ACCOUNT_SUSPENDED":
      return {
        type: "SYSTEM",
        title: "Your account has been restricted",
        body: "Sign in to see more information, or contact support.",
        href: "/",
        data: {},
      };
    case "ACCOUNT_RESTORED":
      return {
        type: "SYSTEM",
        title: "Your account is active again",
        body: "Your access has been restored.",
        href: "/",
        data: {},
      };
    case "CRITICAL_RESULT_ALERTED":
      return {
        type: "CRITICAL_RESULT",
        title: "Critical result requires acknowledgement",
        // No clinical detail in the notification itself — open the app to view it.
        body: "A critical laboratory result is awaiting your acknowledgement. Sign in to review and acknowledge it.",
        href: role === "LAB_SCIENTIST" ? "/lab/critical-alerts" : role === "DOCTOR" ? "/doctor/lab-requests" : "/lab/critical-alerts",
        data: { alertId: event.alertId, orderId: event.orderId },
      };
    case "CRITICAL_ALERT_ACKNOWLEDGED":
      return {
        type: "CRITICAL_RESULT",
        title: "Critical result acknowledged",
        body: "The critical result alert has been acknowledged by the responsible clinician.",
        href: role === "LAB_SCIENTIST" ? "/lab/critical-alerts" : "/doctor/lab-requests",
        data: { alertId: event.alertId },
      };
    case "INVESTIGATION_UPDATED":
      return {
        type: "INVESTIGATION_UPDATE",
        title: "Investigation status update",
        body: "The status of an investigation you ordered has changed. Sign in to view the details.",
        href: role === "LAB_SCIENTIST" ? "/lab/orders" : role === "DOCTOR" ? "/doctor/lab-requests" : "/facilities/investigations",
        data: { orderId: event.orderId },
      };
    case "DIAGNOSTIC_REPORT_READY":
      return {
        type: "INVESTIGATION_UPDATE",
        title: "Diagnostic report ready",
        body: "A finalized diagnostic report is available for an examination you referred. Sign in to view it.",
        href: role === "LAB_SCIENTIST" ? "/lab/examinations" : role === "DOCTOR" ? "/doctor/lab-requests" : "/facilities/investigations",
        data: { bookingId: event.bookingId },
      };
  }
}
