import type { FacilityBookingWorkflowStage } from "@prisma/client";
import type { FacilityPermission } from "./facility-staff";

/**
 * Operational workflow for facility bookings, separate from the existing
 * REQUESTED/CONFIRMED/COMPLETED status. Two paths share one machine:
 *
 * - Laboratory: BOOKED → CHECKED_IN → SAMPLE_COLLECTED → SAMPLE_RECEIVED →
 *   PROCESSING → RESULT_ENTERED → VERIFIED → APPROVED (where required) → RELEASED
 * - Diagnostic: BOOKED → CHECKED_IN → PROCEDURE_COMPLETED → IMAGES_UPLOADED →
 *   REPORT_DRAFTED → REVIEWED → RELEASED
 *
 * RELEASED is the only stage that makes a report available to the patient and
 * triggers their notification; it is never set implicitly by another action.
 */
export const WORKFLOW_TRANSITIONS: ReadonlyArray<{
  from: FacilityBookingWorkflowStage;
  to: FacilityBookingWorkflowStage;
  permission: FacilityPermission;
}> = [
  { from: "BOOKED", to: "CHECKED_IN", permission: "MANAGE_BOOKINGS" },
  { from: "CHECKED_IN", to: "SAMPLE_COLLECTED", permission: "PROCESS_ORDERS" },
  { from: "CHECKED_IN", to: "PROCEDURE_COMPLETED", permission: "PROCESS_ORDERS" },
  { from: "SAMPLE_COLLECTED", to: "SAMPLE_RECEIVED", permission: "PROCESS_ORDERS" },
  { from: "SAMPLE_RECEIVED", to: "PROCESSING", permission: "PROCESS_ORDERS" },
  { from: "PROCESSING", to: "RESULT_ENTERED", permission: "ENTER_RESULTS" },
  { from: "RESULT_ENTERED", to: "VERIFIED", permission: "VERIFY_RESULTS" },
  { from: "VERIFIED", to: "APPROVED", permission: "VERIFY_RESULTS" },
  { from: "VERIFIED", to: "RELEASED", permission: "RELEASE_RESULTS" },
  { from: "APPROVED", to: "RELEASED", permission: "RELEASE_RESULTS" },
  { from: "PROCEDURE_COMPLETED", to: "IMAGES_UPLOADED", permission: "ENTER_RESULTS" },
  { from: "IMAGES_UPLOADED", to: "REPORT_DRAFTED", permission: "ENTER_RESULTS" },
  { from: "REPORT_DRAFTED", to: "REVIEWED", permission: "VERIFY_RESULTS" },
  { from: "REVIEWED", to: "RELEASED", permission: "RELEASE_RESULTS" },
  { from: "RELEASED", to: "AMENDED", permission: "VERIFY_RESULTS" },
  { from: "AMENDED", to: "RELEASED", permission: "RELEASE_RESULTS" },
  { from: "RELEASED", to: "ARCHIVED", permission: "MANAGE_BOOKINGS" },
  { from: "AMENDED", to: "ARCHIVED", permission: "MANAGE_BOOKINGS" },
];

/** Stages that mean work is pending (dashboard "result queue" widget). */
export const ACTIVE_WORKFLOW_STAGES: FacilityBookingWorkflowStage[] = [
  "BOOKED",
  "CHECKED_IN",
  "SAMPLE_COLLECTED",
  "SAMPLE_RECEIVED",
  "PROCESSING",
  "RESULT_ENTERED",
  "VERIFIED",
  "APPROVED",
  "PROCEDURE_COMPLETED",
  "IMAGES_UPLOADED",
  "REPORT_DRAFTED",
  "REVIEWED",
];

export function allowedWorkflowTargets(
  stage: FacilityBookingWorkflowStage,
): { to: FacilityBookingWorkflowStage; permission: FacilityPermission }[] {
  return WORKFLOW_TRANSITIONS.filter((t) => t.from === stage).map(({ to, permission }) => ({ to, permission }));
}

export function transitionAllowed(
  from: FacilityBookingWorkflowStage,
  to: FacilityBookingWorkflowStage,
): { to: FacilityBookingWorkflowStage; permission: FacilityPermission } | null {
  return WORKFLOW_TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

export const WORKFLOW_STAGE_LABEL: Record<FacilityBookingWorkflowStage, string> = {
  BOOKED: "Booked",
  CHECKED_IN: "Checked in",
  SAMPLE_COLLECTED: "Sample collected",
  SAMPLE_RECEIVED: "Sample received",
  PROCESSING: "Processing",
  RESULT_ENTERED: "Result entered",
  VERIFIED: "Verified",
  APPROVED: "Approved",
  PROCEDURE_COMPLETED: "Procedure completed",
  IMAGES_UPLOADED: "Images uploaded",
  REPORT_DRAFTED: "Report drafted",
  REVIEWED: "Reviewed",
  RELEASED: "Released to patient",
  AMENDED: "Amended",
  ARCHIVED: "Archived",
};
