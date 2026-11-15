import { randomInt } from "node:crypto";
import { z } from "zod";
import type { SupportTicketPriority, SupportTicketType } from "@prisma/client";

export const SUPPORT_TYPES = [
  "CONTACT", "TECHNICAL", "ACCOUNT", "DATA_CORRECTION", "SECURITY", "CLINICAL_SAFETY", "FEEDBACK", "FACILITY_ONBOARDING",
] as const satisfies readonly SupportTicketType[];

export const SUPPORT_TYPE_LABELS: Record<SupportTicketType, string> = {
  CONTACT: "General question",
  TECHNICAL: "Technical problem",
  ACCOUNT: "Account help",
  DATA_CORRECTION: "Incorrect information in a record",
  SECURITY: "Suspected unauthorised access or security concern",
  CLINICAL_SAFETY: "Patient safety concern",
  FEEDBACK: "Feedback or suggestion",
  FACILITY_ONBOARDING: "Setting up a facility",
};

/** Types that anonymous visitors may file. Record-related reports need a signed-in, identified reporter. */
export const PUBLIC_SUPPORT_TYPES = ["CONTACT", "TECHNICAL", "ACCOUNT", "FEEDBACK", "FACILITY_ONBOARDING", "SECURITY"] as const;

/** Hours until a first response is due, by priority. */
export const SLA_HOURS: Record<SupportTicketPriority, number> = { URGENT: 2, HIGH: 8, NORMAL: 24, LOW: 72 };

export function defaultPriority(type: SupportTicketType): SupportTicketPriority {
  switch (type) {
    case "SECURITY":
    case "CLINICAL_SAFETY":
      return "URGENT";
    case "DATA_CORRECTION":
      return "HIGH";
    case "FEEDBACK":
      return "LOW";
    default:
      return "NORMAL";
  }
}

export function slaDueAt(priority: SupportTicketPriority, from = new Date()): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * 3_600_000);
}

const REFERENCE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

/** A short, unguessable reference such as SUP-7K3QZ9XM that people can quote to support. */
export function generateTicketReference(): string {
  let out = "SUP-";
  for (let i = 0; i < 8; i += 1) out += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return out;
}

/** Only a path is kept: query strings and fragments can carry identifiers or tokens. */
export function sanitizePagePath(value: string | null | undefined): string | null {
  if (!value) return null;
  const path = value.split(/[?#]/)[0];
  return path.startsWith("/") && !path.startsWith("//") ? path.slice(0, 300) : null;
}

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const base = {
  subject: text(3, 160),
  message: text(10, 5000),
  pagePath: z.string().max(400).optional(),
};

/** Public form: contact details are required because there is no account to reply to. */
export const publicContactSchema = z.object({
  type: z.enum(PUBLIC_SUPPORT_TYPES).default("CONTACT"),
  name: text(2, 120),
  email: z.string().trim().toLowerCase().email().max(254),
  ...base,
  /** Honeypot: real people never see or fill this field. */
  website: z.string().max(200).optional(),
});

/** Signed-in form: identity comes from the session, never from the request body. */
export const memberTicketSchema = z.object({
  type: z.enum(SUPPORT_TYPES).default("TECHNICAL"),
  ...base,
});

export const adminTicketUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assignToMe: z.boolean().optional(),
  note: text(1, 2000).optional(),
}).refine((v) => v.status || v.priority || v.assignToMe || v.note, { message: "Nothing to update" });

/** Terminal statuses stop the SLA clock. */
export function isClosedStatus(status: string): boolean {
  return status === "RESOLVED" || status === "CLOSED";
}

export function isOverdue(ticket: { status: string; slaDueAt: Date; firstResponseAt: Date | null }, now = new Date()): boolean {
  return !ticket.firstResponseAt && !isClosedStatus(ticket.status) && ticket.slaDueAt.getTime() < now.getTime();
}

/** Acknowledgement email: generic by design, never repeats what the person wrote. */
export function renderAcknowledgement(reference: string, appUrl: string) {
  const subject = `We received your message (${reference}) · Medic1905`;
  const text = [
    "Thank you for contacting Medic1905.",
    "",
    `Your reference is ${reference}. Please quote it if you contact us again.`,
    "",
    "Our support team will reply to this email address. For your privacy, never send health details by email.",
    "",
    "If this is a medical emergency, contact your local emergency services immediately.",
    appUrl,
  ].join("\n");
  const html = `<p>Thank you for contacting Medic1905.</p><p>Your reference is <strong>${reference}</strong>. Please quote it if you contact us again.</p><p>Our support team will reply to this email address. For your privacy, never send health details by email.</p><p>If this is a medical emergency, contact your local emergency services immediately.</p>`;
  return { subject, text, html };
}
