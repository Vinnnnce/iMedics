import { afterEach, describe, expect, it, vi } from "vitest";
import { renderNotification, type NotificationEvent } from "./events";
import { renderEmail, sendEmail } from "./email";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("privacy-safe notification email templates", () => {
  const events: NotificationEvent[] = [
    { kind: "APPOINTMENT_CONFIRMED", appointmentId: "appointment-id" },
    { kind: "RESULTS_AVAILABLE", analysisId: "analysis-id" },
    { kind: "MESSAGE_RECEIVED", conversationId: "conversation-id" },
    { kind: "PAYMENT_SUCCESSFUL", paymentId: "payment-id" },
    { kind: "TASK_CREATED", taskId: "task-id" },
    { kind: "TASK_COMPLETED", taskId: "task-id" },
    { kind: "ACCOUNT_REGISTERED" }, { kind: "ACCOUNT_UPDATED" },
  ];
  it.each(events)("renders $kind as text and escaped HTML", event => {
    const template = renderEmail(renderNotification(event, "PATIENT"));
    expect(template.subject).toContain("Medic1905");
    expect(template.text).toContain("Sign in");
    expect(template.html).toContain("Open Medic1905");
    expect(template.text).not.toMatch(/task-id|conversation-id|analysis-id/);
  });
  it("escapes injected markup and prevents external notification links", () => {
    const template = renderEmail({ type: "SYSTEM", title: "<script>alert(1)</script>", body: "<img src=x>", href: "//evil.example", data: {} });
    expect(template.html).not.toContain("<script>");
    expect(template.html).not.toContain("<img src=x>");
    expect(template.html).not.toContain("//evil.example");
  });
  it("does not claim unconfigured email was delivered", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendEmail({ to: "nobody@example.com", subject: "Update", text: "Update", html: "Update" })).rejects.toThrow("not configured");
  });
  it("sends the stable idempotency key and a bounded request", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-only-not-a-secret");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail({ to: "nobody@example.com", subject: "Update", text: "Update", html: "Update", idempotencyKey: "delivery-id" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers["Idempotency-Key"]).toBe("delivery-id");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
