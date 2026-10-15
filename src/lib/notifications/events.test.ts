import { describe, expect, it } from "vitest";
import { renderNotification, type NotificationEvent } from "./events";
import { renderEmail } from "./email";

const id = "11111111-1111-4111-8111-111111111111";
const events: NotificationEvent[] = [
  { kind: "APPOINTMENT_REQUESTED", appointmentId: id },
  { kind: "APPOINTMENT_CONFIRMED", appointmentId: id },
  { kind: "APPOINTMENT_CANCELLED", appointmentId: id },
  { kind: "APPOINTMENT_RESCHEDULED", appointmentId: id },
  { kind: "APPOINTMENT_REMINDER", appointmentId: id, window: "24h" },
  { kind: "APPOINTMENT_REMINDER", appointmentId: id, window: "1h" },
  { kind: "MESSAGE_RECEIVED", conversationId: id },
  { kind: "PAYMENT_SUCCESSFUL", paymentId: id },
  { kind: "PAYMENT_FAILED", paymentId: id },
  { kind: "PAYMENT_REFUND_PENDING", paymentId: id },
  { kind: "PAYMENT_REFUNDED", paymentId: id },
  { kind: "FACILITY_BOOKING_REQUESTED", bookingId: id },
  { kind: "FACILITY_BOOKING_UPDATED", bookingId: id },
  { kind: "RESULTS_AVAILABLE", analysisId: id },
];
const roles = ["PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"] as const;

describe("notification templates", () => {
  it("only link to relative in-app paths", () => {
    for (const event of events) {
      for (const role of roles) {
        const { href } = renderNotification(event, role);
        expect(href.startsWith("/")).toBe(true);
        expect(href.startsWith("//")).toBe(false);
      }
    }
  });

  it("never put clinical terms, money or names in the visible text", () => {
    const banned = /diagnos|prescri|medicat|lab result|blood|hiv|cancer|₦|\$|NGN|ICD/i;
    for (const event of events) {
      for (const role of roles) {
        const { title, body } = renderNotification(event, role);
        expect(`${title} ${body}`).not.toMatch(banned);
      }
    }
  });

  it("deep-links payments to the payment page and routes by role", () => {
    expect(renderNotification({ kind: "PAYMENT_SUCCESSFUL", paymentId: id }, "PATIENT").href).toBe(`/payments/${id}`);
    expect(renderNotification({ kind: "APPOINTMENT_CONFIRMED", appointmentId: id }, "PATIENT").href).toBe("/patient/appointments");
    expect(renderNotification({ kind: "APPOINTMENT_REQUESTED", appointmentId: id }, "DOCTOR").href).toBe("/doctor/booking-requests");
    expect(renderNotification({ kind: "MESSAGE_RECEIVED", conversationId: id }, "DOCTOR").href).toBe("/doctor/chat");
  });

  it("uses the right category for each event", () => {
    expect(renderNotification({ kind: "MESSAGE_RECEIVED", conversationId: id }, "PATIENT").type).toBe("MESSAGE");
    expect(renderNotification({ kind: "PAYMENT_FAILED", paymentId: id }, "PATIENT").type).toBe("PAYMENT");
    expect(renderNotification({ kind: "APPOINTMENT_RESCHEDULED", appointmentId: id }, "PATIENT").type).toBe("APPOINTMENT");
  });
});

describe("renderEmail", () => {
  it("links into the app and escapes HTML", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
    const email = renderEmail({ type: "SYSTEM", title: "A <b>title</b>", body: "x & y", href: "/payments/1", data: {} });
    expect(email.html).toContain("https://app.example.com/payments/1");
    expect(email.html).not.toContain("<b>title</b>");
    expect(email.html).toContain("x &amp; y");
    expect(email.text).toContain("https://app.example.com/payments/1");
    expect(email.text).toMatch(/never put health details in email/i);
  });
});
