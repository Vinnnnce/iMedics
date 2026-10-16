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
  | { kind: "FACILITY_BOOKING_REQUESTED"; bookingId: string }
  | { kind: "FACILITY_BOOKING_UPDATED"; bookingId: string }
  | { kind: "RESULTS_AVAILABLE"; analysisId: string }
  | { kind: "TASK_CREATED"; taskId: string }
  | { kind: "TASK_COMPLETED"; taskId: string }
  | { kind: "ACCOUNT_REGISTERED" }
  | { kind: "ACCOUNT_UPDATED" };

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
  }
}
