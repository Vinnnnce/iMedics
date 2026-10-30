import { badRequest, conflict } from "@/lib/errors";
import { OBSERVATION_TYPES, type ObservationType } from "./observation-types";
export { OBSERVATION_TYPES };

/**
 * Nursing and pharmacy workflow domain rules.
 *
 * Observation types carry a unit registry so entries are timestamped,
 * unit-annotated and attributable — but validation is format-only. No clinical
 * thresholds, scores or automatic flags are invented here; interpretation
 * stays with the qualified clinician reading the chart.
 */

export function observationType(key: string): ObservationType {
  const type = OBSERVATION_TYPES.find((t) => t.key === key);
  if (!type) throw badRequest("Unknown observation type");
  return type;
}

/** Validate an observation entry: known type, well-formed value, unit fixed by the registry. */
export function validateObservation(key: string, value: string): { type: ObservationType; value: string } {
  const type = observationType(key);
  const trimmed = value.trim();
  if (!trimmed) throw badRequest("The observation value is empty");
  if (trimmed.length > 60) throw badRequest("The observation value is too long");
  if (type.pattern && !type.pattern.test(trimmed)) {
    throw badRequest(`${type.label} is recorded as ${type.unit} — check the value format (e.g. ${type.key === "BLOOD_PRESSURE" ? "120/80" : "72"})`);
  }
  return { type, value: trimmed };
}

/** Care-task lifecycle: due → in progress → completed, with defer/escalate side exits. */
export const TASK_STATUSES = ["DUE", "IN_PROGRESS", "COMPLETED", "DEFERRED", "ESCALATED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  DUE: ["IN_PROGRESS", "COMPLETED", "DEFERRED", "ESCALATED"],
  IN_PROGRESS: ["COMPLETED", "DEFERRED", "ESCALATED", "DUE"],
  COMPLETED: [],
  DEFERRED: ["DUE", "ESCALATED", "IN_PROGRESS"],
  ESCALATED: ["IN_PROGRESS", "COMPLETED", "DUE"],
};

export function validateTaskTransition(from: string, to: string): TaskStatus {
  if (!TASK_STATUSES.includes(to as TaskStatus)) throw badRequest("Unknown task status");
  if (!TASK_STATUSES.includes(from as TaskStatus)) throw badRequest("Unknown task status");
  if (from === to) throw conflict("The task is already in that status");
  const allowed = TASK_TRANSITIONS[from as TaskStatus];
  if (!allowed.includes(to as TaskStatus)) throw conflict(`A ${from.toLowerCase().replace("_", " ")} task cannot move to ${to.toLowerCase().replace("_", " ")}`);
  return to as TaskStatus;
}

/** Medication-order lifecycle with pharmacy review and dispensing. */
export const MEDICATION_STATUSES = ["DRAFT", "SUBMITTED", "REVIEWED", "DISPENSED", "COMPLETED", "CANCELLED"] as const;
export type MedicationStatus = (typeof MEDICATION_STATUSES)[number];

const MEDICATION_TRANSITIONS: Record<MedicationStatus, readonly MedicationStatus[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["REVIEWED", "CANCELLED"],
  REVIEWED: ["DISPENSED", "CANCELLED"],
  DISPENSED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function validateMedicationTransition(from: string, to: string): MedicationStatus {
  if (!MEDICATION_STATUSES.includes(to as MedicationStatus)) throw badRequest("Unknown medication order status");
  if (!MEDICATION_STATUSES.includes(from as MedicationStatus)) throw badRequest("Unknown medication order status");
  if (from === to) throw conflict("The order is already in that status");
  const allowed = MEDICATION_TRANSITIONS[from as MedicationStatus];
  if (!allowed.includes(to as MedicationStatus)) throw conflict(`A ${from.toLowerCase()} order cannot move to ${to.toLowerCase()}`);
  return to as MedicationStatus;
}

/** Which side of the workflow may move an order into a status. */
export function transitionRequiresReview(to: MedicationStatus): boolean {
  return ["REVIEWED", "DISPENSED"].includes(to);
}
