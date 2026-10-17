import type { RenderedNotification } from "./events";
import { safeNotificationHref } from "./safe-href";

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain, privacy-safe email: a generic message and a link into the signed-in app. */
export function renderEmail(notification: RenderedNotification) {
  const link = `${appUrl()}${safeNotificationHref(notification.href)}`;
  const settings = `${appUrl()}/profile#notifications`;
  const subject = `${notification.title} · Medic1905`;
  const text = [
    notification.title,
    "",
    notification.body,
    "",
    `Open Medic1905: ${link}`,
    "",
    "For your privacy, we never put health details in email. Sign in to see the full information.",
    `Manage email preferences: ${settings}`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:12px;padding:28px">
<tr><td><p style="margin:0 0 4px;font-size:13px;color:#666">Medic1905</p>
<h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(notification.title)}</h1>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${escapeHtml(notification.body)}</p>
<a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Open Medic1905</a>
<p style="margin:24px 0 0;font-size:12px;color:#777;line-height:1.5">For your privacy, we never put health details in email. Sign in to see the full information.<br><a href="${escapeHtml(settings)}" style="color:#777">Manage email preferences</a></p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/**
 * Send an email through Resend's HTTP API (no SDK needed). Without RESEND_API_KEY the message is logged instead,
 * so development works with no email provider configured.
 */
export async function sendEmail(input: { to: string; subject: string; text: string; html: string; idempotencyKey?: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email delivery is not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Medic1905 <notifications@example.com>",
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });
  if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
}
