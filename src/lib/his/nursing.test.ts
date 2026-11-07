import { describe, expect, it } from "vitest";
import {
  OBSERVATION_TYPES, validateObservation,
  TASK_STATUSES, validateTaskTransition,
  MEDICATION_STATUSES, validateMedicationTransition, transitionRequiresReview,
} from "./nursing";

describe("observation registry", () => {
  it("fixes a unit per type and validates formats", () => {
    const { type, value } = validateObservation("TEMPERATURE", "36.8");
    expect(type.unit).toBe("°C");
    expect(value).toBe("36.8");
    expect(() => validateObservation("PULSE", "88")).not.toThrow();
    expect(() => validateObservation("BLOOD_PRESSURE", "120/80")).not.toThrow();
    expect(() => validateObservation("BLOOD_PRESSURE", "120")).toThrow(/Blood pressure/);
    expect(() => validateObservation("SPO2", "high")).toThrow(/Oxygen saturation/);
    expect(() => validateObservation("PAIN", "11")).toThrow(/Pain score/);
  });

  it("rejects unknown types and empty values", () => {
    expect(() => validateObservation("MOOD", "7")).toThrow(/Unknown observation type/);
    expect(() => validateObservation("PULSE", "   ")).toThrow(/empty/);
  });

  it("registers only format rules — no clinical thresholds", () => {
    // A physiologically extreme but well-formed value must be accepted:
    // interpretation belongs to the clinician, not the registry.
    expect(() => validateObservation("PULSE", "999")).not.toThrow();
    const bp = OBSERVATION_TYPES.find((t) => t.key === "BLOOD_PRESSURE");
    expect(bp?.unit).toBe("mmHg");
  });
});

describe("care task lifecycle", () => {
  it("allows the ward flow due → in progress → completed", () => {
    expect(validateTaskTransition("DUE", "IN_PROGRESS")).toBe("IN_PROGRESS");
    expect(validateTaskTransition("IN_PROGRESS", "COMPLETED")).toBe("COMPLETED");
    expect(validateTaskTransition("DUE", "COMPLETED")).toBe("COMPLETED");
  });

  it("allows defer and escalate side exits and reopening", () => {
    expect(validateTaskTransition("DUE", "DEFERRED")).toBe("DEFERRED");
    expect(validateTaskTransition("DUE", "ESCALATED")).toBe("ESCALATED");
    expect(validateTaskTransition("DEFERRED", "DUE")).toBe("DUE");
    expect(validateTaskTransition("ESCALATED", "COMPLETED")).toBe("COMPLETED");
  });

  it("rejects completed tasks reopening and unknown statuses", () => {
    expect(() => validateTaskTransition("COMPLETED", "DUE")).toThrow(/cannot move/);
    expect(() => validateTaskTransition("DUE", "ARCHIVED")).toThrow(/Unknown task status/);
    expect(() => validateTaskTransition("DUE", "DUE")).toThrow(/already/);
    expect(TASK_STATUSES).toEqual(["DUE", "IN_PROGRESS", "COMPLETED", "DEFERRED", "ESCALATED"]);
  });
});

describe("medication order lifecycle", () => {
  it("walks draft → submitted → reviewed → dispensed → completed", () => {
    expect(validateMedicationTransition("DRAFT", "SUBMITTED")).toBe("SUBMITTED");
    expect(validateMedicationTransition("SUBMITTED", "REVIEWED")).toBe("REVIEWED");
    expect(validateMedicationTransition("REVIEWED", "DISPENSED")).toBe("DISPENSED");
    expect(validateMedicationTransition("DISPENSED", "COMPLETED")).toBe("COMPLETED");
  });

  it("allows cancelling at any live stage but never resurrects orders", () => {
    for (const from of ["DRAFT", "SUBMITTED", "REVIEWED", "DISPENSED"] as const) {
      expect(validateMedicationTransition(from, "CANCELLED")).toBe("CANCELLED");
    }
    expect(() => validateMedicationTransition("CANCELLED", "SUBMITTED")).toThrow(/cannot move/);
    expect(() => validateMedicationTransition("COMPLETED", "DISPENSED")).toThrow(/cannot move/);
    expect(() => validateMedicationTransition("DRAFT", "DISPENSED")).toThrow(/cannot move/);
    expect(() => validateMedicationTransition("DRAFT", "FOO")).toThrow(/Unknown medication order status/);
  });

  it("gates review and dispensing to the pharmacy permission", () => {
    expect(transitionRequiresReview("REVIEWED")).toBe(true);
    expect(transitionRequiresReview("DISPENSED")).toBe(true);
    expect(transitionRequiresReview("SUBMITTED")).toBe(false);
    expect(transitionRequiresReview("CANCELLED")).toBe(false);
    expect(MEDICATION_STATUSES).toContain("DRAFT");
  });
});
