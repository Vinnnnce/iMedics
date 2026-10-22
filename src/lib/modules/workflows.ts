/**
 * Workflow state machines for the three modules.
 *
 * Pure functions — no database access — so every rule (who may transition
 * what, which transitions need a reason, which records are immutable once
 * finalized) is unit-testable and enforced identically by every route.
 */

import type { FacilityPermission } from "@/lib/facility-staff";
import { ApiError } from "@/lib/errors";

/** Validation/authorization failure in a workflow transition (422/403/409). */
export class WorkflowError extends ApiError {
  constructor(message: string, status = 422) {
    super(status, message);
    this.name = "WorkflowError";
  }
}

// ---------------------------------------------------------------------------
// Module 02 — laboratory order workflow
// ---------------------------------------------------------------------------

export type LabOrderStatusValue =
  | "ORDERED"
  | "ACCEPTED"
  | "SPECIMEN_PENDING"
  | "SPECIMEN_REJECTED"
  | "IN_PROGRESS"
  | "AWAITING_VERIFICATION"
  | "FINALIZED"
  | "SENT_TO_FACILITY"
  | "AMENDED"
  | "COMPLETED"
  | "CANCELLED";

export const LAB_ORDER_STATUS_LABEL: Record<LabOrderStatusValue, string> = {
  ORDERED: "New request",
  ACCEPTED: "Accepted",
  SPECIMEN_PENDING: "Specimen pending",
  SPECIMEN_REJECTED: "Specimen rejected",
  IN_PROGRESS: "Processing",
  AWAITING_VERIFICATION: "Awaiting verification",
  FINALIZED: "Finalized",
  SENT_TO_FACILITY: "Report sent",
  AMENDED: "Amended",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export interface LabOrderTransition {
  to: LabOrderStatusValue;
  permission?: FacilityPermission;
  reasonRequired?: boolean;
}

export const LAB_ORDER_TRANSITIONS: Record<LabOrderStatusValue, LabOrderTransition[]> = {
  ORDERED: [
    { to: "ACCEPTED", permission: "PROCESS_ORDERS" },
    { to: "SPECIMEN_PENDING", permission: "PROCESS_ORDERS" },
    { to: "CANCELLED", reasonRequired: true },
  ],
  ACCEPTED: [
    { to: "SPECIMEN_PENDING", permission: "PROCESS_ORDERS" },
    { to: "IN_PROGRESS", permission: "ENTER_RESULTS" },
    { to: "CANCELLED", reasonRequired: true },
  ],
  SPECIMEN_PENDING: [
    { to: "IN_PROGRESS", permission: "ENTER_RESULTS" },
    { to: "SPECIMEN_REJECTED", permission: "PROCESS_ORDERS", reasonRequired: true },
    { to: "CANCELLED", reasonRequired: true },
  ],
  SPECIMEN_REJECTED: [
    // Recollection: a new specimen is registered and the order goes back to
    // specimen-pending. The rejected specimen row is preserved.
    { to: "SPECIMEN_PENDING", permission: "PROCESS_ORDERS" },
    { to: "CANCELLED", reasonRequired: true },
  ],
  IN_PROGRESS: [
    { to: "AWAITING_VERIFICATION", permission: "ENTER_RESULTS" },
    { to: "CANCELLED", reasonRequired: true },
  ],
  AWAITING_VERIFICATION: [
    { to: "FINALIZED", permission: "VERIFY_RESULTS" },
    { to: "IN_PROGRESS", permission: "ENTER_RESULTS" },
    { to: "CANCELLED", reasonRequired: true },
  ],
  FINALIZED: [
    { to: "SENT_TO_FACILITY", permission: "RELEASE_RESULTS" },
    // Correction of a finalized report: creates an auditable amendment.
    { to: "AMENDED", permission: "VERIFY_RESULTS", reasonRequired: true },
  ],
  SENT_TO_FACILITY: [{ to: "AMENDED", permission: "VERIFY_RESULTS", reasonRequired: true }],
  AMENDED: [{ to: "SENT_TO_FACILITY", permission: "RELEASE_RESULTS" }],
  COMPLETED: [{ to: "AMENDED", permission: "VERIFY_RESULTS", reasonRequired: true }],
  CANCELLED: [],
};

export function canTransitionLabOrder(
  from: LabOrderStatusValue,
  to: LabOrderStatusValue,
): LabOrderTransition | undefined {
  return LAB_ORDER_TRANSITIONS[from]?.find((t) => t.to === to);
}

export function assertLabOrderTransition(
  from: LabOrderStatusValue,
  to: LabOrderStatusValue,
  permissions: readonly string[],
  reason?: string | null,
): LabOrderTransition {
  const t = canTransitionLabOrder(from, to);
  if (!t) {
    throw new WorkflowError(`An order cannot move from ${LAB_ORDER_STATUS_LABEL[from]} to ${LAB_ORDER_STATUS_LABEL[to]}`);
  }
  if (t.permission && !permissions.includes(t.permission)) {
    throw new WorkflowError("Your role does not allow this action", 403);
  }
  if (t.reasonRequired && (!reason || !reason.trim())) {
    throw new WorkflowError("A reason is required for this action");
  }
  return t;
}

/** Terminal states from which nothing except amendment is possible. */
export function labOrderIsFinal(status: LabOrderStatusValue): boolean {
  return status === "FINALIZED" || status === "SENT_TO_FACILITY" || status === "COMPLETED" || status === "AMENDED";
}

// ---------------------------------------------------------------------------
// Module 02 — specimen workflow
// ---------------------------------------------------------------------------

export type SpecimenStatusValue =
  | "PENDING_COLLECTION"
  | "COLLECTED"
  | "RECEIVED"
  | "REJECTED"
  | "RECOLLECTION_REQUESTED"
  | "PROCESSED";

export const SPECIMEN_STATUS_LABEL: Record<SpecimenStatusValue, string> = {
  PENDING_COLLECTION: "Awaiting collection",
  COLLECTED: "Collected",
  RECEIVED: "Received",
  REJECTED: "Rejected",
  RECOLLECTION_REQUESTED: "Recollection requested",
  PROCESSED: "Processed",
};

export interface SpecimenTransition {
  to: SpecimenStatusValue;
  permission?: FacilityPermission;
  reasonRequired?: boolean;
}

export const SPECIMEN_TRANSITIONS: Record<SpecimenStatusValue, SpecimenTransition[]> = {
  PENDING_COLLECTION: [
    { to: "COLLECTED", permission: "PROCESS_ORDERS" },
    { to: "REJECTED", permission: "PROCESS_ORDERS", reasonRequired: true },
  ],
  COLLECTED: [
    { to: "RECEIVED", permission: "PROCESS_ORDERS" },
    { to: "REJECTED", permission: "PROCESS_ORDERS", reasonRequired: true },
  ],
  RECEIVED: [
    { to: "PROCESSED", permission: "ENTER_RESULTS" },
    { to: "REJECTED", permission: "PROCESS_ORDERS", reasonRequired: true },
  ],
  REJECTED: [{ to: "RECOLLECTION_REQUESTED", permission: "PROCESS_ORDERS" }],
  RECOLLECTION_REQUESTED: [], // a NEW specimen row is created instead
  PROCESSED: [],
};

export function assertSpecimenTransition(
  from: SpecimenStatusValue,
  to: SpecimenStatusValue,
  permissions: readonly string[],
  reason?: string | null,
): SpecimenTransition {
  const t = SPECIMEN_TRANSITIONS[from]?.find((x) => x.to === to);
  if (!t) {
    throw new WorkflowError(`A specimen cannot move from ${SPECIMEN_STATUS_LABEL[from]} to ${SPECIMEN_STATUS_LABEL[to]}`);
  }
  if (t.permission && !permissions.includes(t.permission)) {
    throw new WorkflowError("Your role does not allow this action", 403);
  }
  if (t.reasonRequired && (!reason || !reason.trim())) {
    throw new WorkflowError("A rejection reason is required");
  }
  return t;
}

// ---------------------------------------------------------------------------
// Module 01 — admission workflow
// ---------------------------------------------------------------------------

export type AdmissionStatusValue = "ACTIVE" | "DISCHARGED" | "TRANSFERRED" | "CANCELLED";

export const ADMISSION_STATUS_LABEL: Record<AdmissionStatusValue, string> = {
  ACTIVE: "Active admission",
  DISCHARGED: "Discharged",
  TRANSFERRED: "Transferred",
  CANCELLED: "Cancelled",
};

/**
 * Which fields may be edited on an admission. Clinical fields are frozen
 * once the episode is closed; the discharge record itself is immutable
 * (corrections are recorded as new amendment-free versions in the audit log
 * via the reason parameter).
 */
export function admissionIsEditable(status: AdmissionStatusValue): boolean {
  return status === "ACTIVE";
}

export function assertAdmissionDischarge(
  status: AdmissionStatusValue,
  epicrisis?: string | null,
): void {
  if (status !== "ACTIVE") {
    throw new WorkflowError(`Only active admissions can be discharged (current: ${ADMISSION_STATUS_LABEL[status]})`);
  }
  if (!epicrisis || !epicrisis.trim()) {
    throw new WorkflowError("A discharge summary (epicrisis) is required before discharge");
  }
}

export function assertAdmissionTransfer(
  status: AdmissionStatusValue,
  summary?: string | null,
): void {
  if (status !== "ACTIVE") {
    throw new WorkflowError(`Only active admissions can be transferred (current: ${ADMISSION_STATUS_LABEL[status]})`);
  }
  if (!summary || !summary.trim()) {
    throw new WorkflowError("A transfer summary is required");
  }
}

// ---------------------------------------------------------------------------
// Module 03 — diagnostic report workflow
// ---------------------------------------------------------------------------

export type DiagnosticReportStatusValue =
  | "DRAFT"
  | "AWAITING_VERIFICATION"
  | "FINALIZED"
  | "SENT"
  | "AMENDED";

export const DIAGNOSTIC_REPORT_STATUS_LABEL: Record<DiagnosticReportStatusValue, string> = {
  DRAFT: "Draft",
  AWAITING_VERIFICATION: "Awaiting verification",
  FINALIZED: "Finalized",
  SENT: "Sent to hospital",
  AMENDED: "Amended",
};

export interface DiagnosticReportTransition {
  to: DiagnosticReportStatusValue;
  permission?: FacilityPermission;
  reasonRequired?: boolean;
}

export const DIAGNOSTIC_REPORT_TRANSITIONS: Record<DiagnosticReportStatusValue, DiagnosticReportTransition[]> = {
  DRAFT: [
    { to: "AWAITING_VERIFICATION", permission: "ENTER_RESULTS" },
  ],
  AWAITING_VERIFICATION: [
    { to: "FINALIZED", permission: "VERIFY_RESULTS" },
    { to: "DRAFT", permission: "ENTER_RESULTS" },
  ],
  FINALIZED: [
    { to: "SENT", permission: "RELEASE_RESULTS" },
    { to: "AMENDED", permission: "VERIFY_RESULTS", reasonRequired: true },
  ],
  SENT: [{ to: "AMENDED", permission: "VERIFY_RESULTS", reasonRequired: true }],
  AMENDED: [{ to: "SENT", permission: "RELEASE_RESULTS" }],
};

/** Reports in these states can no longer be edited in place. */
export function diagnosticReportIsLocked(status: DiagnosticReportStatusValue): boolean {
  return status === "FINALIZED" || status === "SENT" || status === "AMENDED";
}

export function assertDiagnosticReportTransition(
  from: DiagnosticReportStatusValue,
  to: DiagnosticReportStatusValue,
  permissions: readonly string[],
  reason?: string | null,
): DiagnosticReportTransition {
  const t = DIAGNOSTIC_REPORT_TRANSITIONS[from]?.find((x) => x.to === to);
  if (!t) {
    throw new WorkflowError(
      `A report cannot move from ${DIAGNOSTIC_REPORT_STATUS_LABEL[from]} to ${DIAGNOSTIC_REPORT_STATUS_LABEL[to]}`,
    );
  }
  if (t.permission && !permissions.includes(t.permission)) {
    throw new WorkflowError("Your role does not allow this action", 403);
  }
  if (t.reasonRequired && (!reason || !reason.trim())) {
    throw new WorkflowError("An amendment reason is required");
  }
  return t;
}

// ---------------------------------------------------------------------------
// Module 02 — critical result alerts
// ---------------------------------------------------------------------------

export type CriticalAlertStatusValue = "SENT" | "ACKNOWLEDGED" | "ESCALATED" | "RESOLVED";

/** How long an alert may wait before it escalates (spec: escalate when unacknowledged). */
export const CRITICAL_ALERT_ESCALATION_MINUTES = 30;

export function criticalAlertNeedsEscalation(
  status: CriticalAlertStatusValue,
  createdAt: Date,
  now = new Date(),
): boolean {
  if (status !== "SENT") return false;
  return now.getTime() - createdAt.getTime() >= CRITICAL_ALERT_ESCALATION_MINUTES * 60_000;
}
