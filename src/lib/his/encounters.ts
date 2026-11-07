import type { CarePriority, EncounterType, EncounterWorkflowStatus } from "@prisma/client";

export const PRIORITY_RANK: Record<CarePriority, number> = { EMERGENCY: 0, URGENT: 1, SEMI_URGENT: 2, ROUTINE: 3, ELECTIVE: 4 };

export const PRIORITY_LABEL: Record<CarePriority, string> = {
  EMERGENCY: "Emergency", URGENT: "Urgent", SEMI_URGENT: "Semi-urgent", ROUTINE: "Routine / non-urgent", ELECTIVE: "Planned / elective",
};

export const TYPE_LABEL: Record<EncounterType, string> = {
  EMERGENCY_DEPARTMENT: "Emergency department", UNSCHEDULED_OUTPATIENT: "Unscheduled outpatient", SCHEDULED_OUTPATIENT: "Scheduled outpatient",
  PLANNED_INPATIENT: "Planned inpatient admission", EMERGENCY_INPATIENT: "Emergency inpatient admission", DAY_SURGERY: "Day surgery",
  PLANNED_PROCEDURE: "Planned procedure", EMERGENCY_PROCEDURE: "Emergency procedure", OBSERVATION: "Observation",
  TRANSFER_IN: "Transfer from another facility", FOLLOW_UP: "Follow-up appointment", OTHER: "Other",
};

export const STATUS_LABEL: Record<EncounterWorkflowStatus, string> = {
  REGISTERED: "Registered", AWAITING_TRIAGE: "Awaiting triage", TRIAGED: "Triaged", AWAITING_CLINICIAN: "Awaiting clinician",
  UNDER_ASSESSMENT: "Under assessment", AWAITING_INVESTIGATIONS: "Awaiting investigations", AWAITING_SPECIALIST: "Awaiting specialist review",
  AWAITING_TREATMENT: "Awaiting treatment", AWAITING_ADMISSION: "Awaiting admission", ADMITTED: "Admitted", IN_PROCEDURE: "In procedure",
  RECOVERING: "Recovering", AWAITING_DISCHARGE: "Awaiting discharge", DISCHARGED: "Discharged", TRANSFERRED: "Transferred",
  CANCELLED: "Cancelled", DID_NOT_ATTEND: "Did not attend",
};

export const TERMINAL_STATUSES: readonly EncounterWorkflowStatus[] = ["DISCHARGED", "TRANSFERRED", "CANCELLED", "DID_NOT_ATTEND"];

export function canTransition(from: EncounterWorkflowStatus, to: EncounterWorkflowStatus): boolean {
  if (from === to) return false;
  if (TERMINAL_STATUSES.includes(from)) return false;
  if (to === "TRIAGED") return from === "AWAITING_TRIAGE" || from === "REGISTERED";
  if (to === "DID_NOT_ATTEND") return ["REGISTERED", "AWAITING_TRIAGE", "AWAITING_CLINICIAN"].includes(from);
  return true;
}

export function initialStatus(type: EncounterType): EncounterWorkflowStatus {
  return type === "EMERGENCY_DEPARTMENT" || type === "EMERGENCY_INPATIENT" || type === "EMERGENCY_PROCEDURE" ? "AWAITING_TRIAGE" : "REGISTERED";
}

export const OUTPATIENT_TYPES: readonly EncounterType[] = ["UNSCHEDULED_OUTPATIENT", "SCHEDULED_OUTPATIENT", "FOLLOW_UP"];
export const INPATIENT_TYPES: readonly EncounterType[] = ["PLANNED_INPATIENT", "EMERGENCY_INPATIENT", "OBSERVATION", "TRANSFER_IN"];

export const BOARDS = ["emergency", "urgent", "planned", "elective", "inpatient", "outpatient", "waiting", "all"] as const;
export type Board = (typeof BOARDS)[number];

/** Prisma `where` fragment for an operational dashboard. Active encounters only, except "all". */
export function boardFilter(board: Board) {
  const active = { status: { notIn: [...TERMINAL_STATUSES] } };
  switch (board) {
    case "emergency": return { ...active, OR: [{ priority: "EMERGENCY" as const }, { type: "EMERGENCY_DEPARTMENT" as const }] };
    case "urgent": return { ...active, priority: { in: ["URGENT", "SEMI_URGENT"] as CarePriority[] } };
    case "planned": return { ...active, type: { in: ["PLANNED_INPATIENT", "PLANNED_PROCEDURE", "SCHEDULED_OUTPATIENT"] as EncounterType[] } };
    case "elective": return { ...active, priority: "ELECTIVE" as const };
    case "inpatient": return { ...active, OR: [{ type: { in: [...INPATIENT_TYPES] } }, { status: "ADMITTED" as const }] };
    case "outpatient": return { ...active, type: { in: [...OUTPATIENT_TYPES] } };
    case "waiting": return { status: { in: ["REGISTERED", "AWAITING_TRIAGE", "AWAITING_CLINICIAN", "AWAITING_INVESTIGATIONS", "AWAITING_SPECIALIST", "AWAITING_TREATMENT", "AWAITING_ADMISSION", "AWAITING_DISCHARGE"] as EncounterWorkflowStatus[] } };
    default: return {};
  }
}

export function minutesSince(date: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
}

export function isOverdue(statusChangedAt: Date, status: EncounterWorkflowStatus, thresholdMinutes: number, now = new Date()): boolean {
  return !TERMINAL_STATUSES.includes(status) && minutesSince(statusChangedAt, now) > thresholdMinutes;
}

export function sortQueue<T extends { priority: CarePriority; registeredAt: Date }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.registeredAt.getTime() - b.registeredAt.getTime());
}
