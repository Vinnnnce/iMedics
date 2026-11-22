import type { InvestigationDomain, InvestigationItemStatus } from "@prisma/client";

type S = InvestigationItemStatus;

/**
 * Allowed forward transitions of an order item, per domain. The lists follow the
 * 14-step laboratory and 14-step diagnostic workflows; rejections and
 * cancellations are the only branches. Result entry / verification / signing /
 * release are moved by the results service (they need permissions and
 * records), the rest by the facility "advance" action.
 */
const LAB: Partial<Record<S, S[]>> = {
  NEW_REQUEST: ["AWAITING_SAMPLE", "CANCELLED"],
  AWAITING_SAMPLE: ["SAMPLE_COLLECTED", "CANCELLED"],
  SAMPLE_COLLECTED: ["SAMPLE_RECEIVED", "SAMPLE_REJECTED", "CANCELLED"],
  SAMPLE_RECEIVED: ["ASSIGNED_TO_SECTION", "SAMPLE_REJECTED"],
  SAMPLE_REJECTED: ["AWAITING_SAMPLE", "CANCELLED"],
  ASSIGNED_TO_SECTION: ["PROCESSING"],
  PROCESSING: ["ANALYSIS_COMPLETED"],
  ANALYSIS_COMPLETED: ["RESULT_ENTERED"],
  RESULT_ENTERED: ["AWAITING_VERIFICATION"],
  AWAITING_VERIFICATION: ["VERIFIED", "RESULT_ENTERED"],
  VERIFIED: ["SIGNED"],
  SIGNED: ["RELEASED"],
  RELEASED: ["DELIVERED"],
};

const DIAGNOSTIC: Partial<Record<S, S[]>> = {
  NEW_REQUEST: ["AWAITING_APPOINTMENT", "CANCELLED"],
  AWAITING_APPOINTMENT: ["APPOINTMENT_SCHEDULED", "CANCELLED"],
  APPOINTMENT_SCHEDULED: ["PATIENT_PREPARATION", "CHECKED_IN", "AWAITING_APPOINTMENT", "CANCELLED"],
  PATIENT_PREPARATION: ["CHECKED_IN", "AWAITING_APPOINTMENT", "CANCELLED"],
  CHECKED_IN: ["EXAM_IN_PROGRESS", "CANCELLED"],
  EXAM_IN_PROGRESS: ["EXAM_COMPLETED"],
  EXAM_COMPLETED: ["MEDIA_UPLOADED", "AWAITING_INTERPRETATION"],
  MEDIA_UPLOADED: ["AWAITING_INTERPRETATION"],
  AWAITING_INTERPRETATION: ["PRELIMINARY_REPORT", "AWAITING_VERIFICATION"],
  PRELIMINARY_REPORT: ["AWAITING_VERIFICATION"],
  AWAITING_VERIFICATION: ["VERIFIED", "AWAITING_INTERPRETATION"],
  VERIFIED: ["SIGNED"],
  SIGNED: ["RELEASED"],
  RELEASED: ["DELIVERED"],
};

/** Statuses reachable from the generic "referral pending" holding state. */
const REFERRAL: Partial<Record<S, S[]>> = { REFERRAL_PENDING: ["NEW_REQUEST", "CANCELLED"] };

export function allowedTransitions(domain: InvestigationDomain, from: S): S[] {
  const table = domain === "LABORATORY" ? LAB : DIAGNOSTIC;
  return [...(table[from] ?? []), ...(REFERRAL[from] ?? [])];
}

export function canTransition(domain: InvestigationDomain, from: S, to: S): boolean {
  return allowedTransitions(domain, from).includes(to);
}

/** Transitions that the generic advance endpoint must NOT perform: they carry records and permissions of their own. */
export const RESULT_GATED_STATUSES: S[] = ["RESULT_ENTERED", "AWAITING_VERIFICATION", "VERIFIED", "SIGNED", "RELEASED", "DELIVERED", "PRELIMINARY_REPORT"];

/** The ordered happy path for rendering progress (excludes rejection/cancel branches). */
export function workflowSteps(domain: InvestigationDomain): S[] {
  return domain === "LABORATORY"
    ? ["NEW_REQUEST", "AWAITING_SAMPLE", "SAMPLE_COLLECTED", "SAMPLE_RECEIVED", "ASSIGNED_TO_SECTION", "PROCESSING", "ANALYSIS_COMPLETED", "RESULT_ENTERED", "AWAITING_VERIFICATION", "VERIFIED", "SIGNED", "RELEASED", "DELIVERED"]
    : ["NEW_REQUEST", "AWAITING_APPOINTMENT", "APPOINTMENT_SCHEDULED", "PATIENT_PREPARATION", "CHECKED_IN", "EXAM_IN_PROGRESS", "EXAM_COMPLETED", "MEDIA_UPLOADED", "AWAITING_INTERPRETATION", "PRELIMINARY_REPORT", "AWAITING_VERIFICATION", "VERIFIED", "SIGNED", "RELEASED", "DELIVERED"];
}

/** Statuses a facility must be able to act on, used to build the "next action" label in worklists. */
export function nextActionLabel(domain: InvestigationDomain, status: S): string | null {
  const map: Partial<Record<S, string>> = {
    NEW_REQUEST: domain === "LABORATORY" ? "Accept and request sample" : "Accept and book appointment",
    AWAITING_SAMPLE: "Record collection",
    SAMPLE_COLLECTED: "Receive / reject sample",
    SAMPLE_RECEIVED: "Assign to section",
    ASSIGNED_TO_SECTION: "Start processing",
    PROCESSING: "Complete analysis",
    ANALYSIS_COMPLETED: "Enter results",
    RESULT_ENTERED: "Submit for verification",
    AWAITING_APPOINTMENT: "Schedule appointment",
    APPOINTMENT_SCHEDULED: "Check in patient",
    PATIENT_PREPARATION: "Check in patient",
    CHECKED_IN: "Start examination",
    EXAM_IN_PROGRESS: "Complete examination",
    EXAM_COMPLETED: "Upload images / start report",
    MEDIA_UPLOADED: "Start interpretation",
    AWAITING_INTERPRETATION: "Write report",
    PRELIMINARY_REPORT: "Submit for verification",
    AWAITING_VERIFICATION: "Verify",
    VERIFIED: "Sign",
    SIGNED: "Release",
    RELEASED: "Delivered",
  };
  return map[status] ?? null;
}
