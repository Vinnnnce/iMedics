/**
 * Workflow state-machine tests for the three modules: legal transitions,
 * permission checks, mandatory reasons, and the immutability of finalized
 * records (spec sections 6, 9 and 11).
 */
import { describe, expect, it } from "vitest";
import {
  assertLabOrderTransition,
  labOrderIsFinal,
  assertSpecimenTransition,
  assertAdmissionDischarge,
  assertAdmissionTransfer,
  admissionIsEditable,
  assertDiagnosticReportTransition,
  diagnosticReportIsLocked,
  criticalAlertNeedsEscalation,
  WorkflowError,
} from "./workflows";

const ALL = ["REGISTER_PATIENTS", "PROCESS_ORDERS", "ENTER_RESULTS", "VERIFY_RESULTS", "RELEASE_RESULTS"];
const VIEW_ONLY: string[] = [];

describe("laboratory order workflow (Module 02)", () => {
  it("walks the happy path new -> accepted -> processing -> verification -> finalized -> sent", () => {
    expect(() => assertLabOrderTransition("ORDERED", "ACCEPTED", ALL)).not.toThrow();
    expect(() => assertLabOrderTransition("ACCEPTED", "SPECIMEN_PENDING", ALL)).not.toThrow();
    expect(() => assertLabOrderTransition("SPECIMEN_PENDING", "IN_PROGRESS", ALL)).not.toThrow();
    expect(() => assertLabOrderTransition("IN_PROGRESS", "AWAITING_VERIFICATION", ALL)).not.toThrow();
    expect(() => assertLabOrderTransition("AWAITING_VERIFICATION", "FINALIZED", ALL)).not.toThrow();
    expect(() => assertLabOrderTransition("FINALIZED", "SENT_TO_FACILITY", ALL)).not.toThrow();
  });

  it("rejects impossible jumps (acceptance test 9: finalized results cannot be silently overwritten)", () => {
    expect(() => assertLabOrderTransition("FINALIZED", "IN_PROGRESS", ALL)).toThrow(WorkflowError);
    expect(() => assertLabOrderTransition("SENT_TO_FACILITY", "IN_PROGRESS", ALL)).toThrow(WorkflowError);
    expect(() => assertLabOrderTransition("ORDERED", "FINALIZED", ALL)).toThrow(WorkflowError);
    expect(labOrderIsFinal("FINALIZED")).toBe(true);
    expect(labOrderIsFinal("SENT_TO_FACILITY")).toBe(true);
  });

  it("requires a reason for amendments, cancellations and specimen rejections", () => {
    expect(() => assertLabOrderTransition("FINALIZED", "AMENDED", ALL)).toThrow(/reason/i);
    expect(() => assertLabOrderTransition("FINALIZED", "AMENDED", ALL, "Corrected units")).not.toThrow();
    expect(() => assertLabOrderTransition("ORDERED", "CANCELLED", ALL)).toThrow(/reason/i);
    expect(() => assertSpecimenTransition("COLLECTED", "REJECTED", ALL)).toThrow(/reason/i);
    expect(() => assertSpecimenTransition("COLLECTED", "REJECTED", ALL, "Haemolysed sample")).not.toThrow();
  });

  it("enforces permissions on sensitive transitions", () => {
    // A user who can only view orders cannot finalize results.
    expect(() => assertLabOrderTransition("AWAITING_VERIFICATION", "FINALIZED", VIEW_ONLY)).toThrow(WorkflowError);
    // Verification requires VERIFY_RESULTS even when other permissions exist.
    expect(() => assertLabOrderTransition("AWAITING_VERIFICATION", "FINALIZED", ["PROCESS_ORDERS"])).toThrow(WorkflowError);
  });
});

describe("specimen workflow (Module 02)", () => {
  it("follows collection -> receipt -> processing and blocks reversed moves", () => {
    expect(() => assertSpecimenTransition("PENDING_COLLECTION", "COLLECTED", ALL)).not.toThrow();
    expect(() => assertSpecimenTransition("COLLECTED", "RECEIVED", ALL)).not.toThrow();
    expect(() => assertSpecimenTransition("RECEIVED", "PROCESSED", ALL)).not.toThrow();
    expect(() => assertSpecimenTransition("PROCESSED", "RECEIVED", ALL)).toThrow(WorkflowError);
    expect(() => assertSpecimenTransition("PENDING_COLLECTION", "PROCESSED", ALL)).toThrow(WorkflowError);
    // A rejected specimen is recollected as a NEW specimen, not resurrected.
    expect(() => assertSpecimenTransition("REJECTED", "RECEIVED", ALL)).toThrow(WorkflowError);
  });
});

describe("admission workflow (Module 01)", () => {
  it("requires an epicrisis for discharge", () => {
    expect(() => assertAdmissionDischarge("ACTIVE", "")).toThrow(/epicrisis/i);
    expect(() => assertAdmissionDischarge("ACTIVE", "Patient recovered; see summary.")).not.toThrow();
    expect(() => assertAdmissionDischarge("DISCHARGED", "…")).toThrow(WorkflowError);
  });

  it("requires a summary for transfers and freezes closed episodes", () => {
    expect(() => assertAdmissionTransfer("ACTIVE", "")).toThrow(/summary/i);
    expect(() => assertAdmissionTransfer("ACTIVE", "Deteriorating; ICU capacity needed")).not.toThrow();
    expect(() => assertAdmissionTransfer("DISCHARGED", "…")).toThrow(WorkflowError);
    expect(admissionIsEditable("ACTIVE")).toBe(true);
    expect(admissionIsEditable("DISCHARGED")).toBe(false);
    expect(admissionIsEditable("TRANSFERRED")).toBe(false);
  });
});

describe("diagnostic report workflow (Module 03)", () => {
  it("walks draft -> verification -> finalized -> sent", () => {
    expect(() => assertDiagnosticReportTransition("DRAFT", "AWAITING_VERIFICATION", ALL)).not.toThrow();
    expect(() => assertDiagnosticReportTransition("AWAITING_VERIFICATION", "FINALIZED", ALL)).not.toThrow();
    expect(() => assertDiagnosticReportTransition("FINALIZED", "SENT", ALL)).not.toThrow();
  });

  it("locks finalized reports against in-place edits (acceptance test 9)", () => {
    expect(() => assertDiagnosticReportTransition("FINALIZED", "DRAFT", ALL)).toThrow(WorkflowError);
    expect(() => assertDiagnosticReportTransition("SENT", "AWAITING_VERIFICATION", ALL)).toThrow(WorkflowError);
    expect(diagnosticReportIsLocked("FINALIZED")).toBe(true);
    expect(diagnosticReportIsLocked("SENT")).toBe(true);
    expect(diagnosticReportIsLocked("DRAFT")).toBe(false);
  });

  it("requires a reason for amendments (acceptance test 10)", () => {
    expect(() => assertDiagnosticReportTransition("FINALIZED", "AMENDED", ALL)).toThrow(/reason/i);
    expect(() => assertDiagnosticReportTransition("FINALIZED", "AMENDED", ALL, "Typo in conclusion")).not.toThrow();
    expect(() => assertDiagnosticReportTransition("SENT", "AMENDED", ALL, "Added measurement")).not.toThrow();
    // Verification is a professional action: view-only users cannot finalize.
    expect(() => assertDiagnosticReportTransition("AWAITING_VERIFICATION", "FINALIZED", VIEW_ONLY)).toThrow(WorkflowError);
  });
});

describe("critical alert escalation (Module 02)", () => {
  it("escalates only unacknowledged alerts after the configured window", () => {
    const created = new Date("2026-10-22T10:00:00Z");
    const now = new Date("2026-10-22T10:45:00Z");
    expect(criticalAlertNeedsEscalation("SENT", created, now)).toBe(true);
    expect(criticalAlertNeedsEscalation("ACKNOWLEDGED", created, now)).toBe(false);
    const early = new Date("2026-10-22T10:10:00Z");
    expect(criticalAlertNeedsEscalation("SENT", created, early)).toBe(false);
  });
});
