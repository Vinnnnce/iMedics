/**
 * Access matrix tests (spec section 7): which organization type can reach
 * which module resource, and the denial cases the acceptance tests demand.
 */
import { describe, expect, it } from "vitest";
import { canAccess, accessTo, KIND_MODULES, RESOURCE_MATRIX, RESOURCE_MODULE } from "./access-matrix";

describe("module access per facility kind", () => {
  it("gives hospitals all three modules", () => {
    expect(KIND_MODULES.HOSPITAL).toEqual(["HOSPITAL", "LABORATORY", "DIAGNOSTIC"]);
    expect(canAccess("HOSPITAL", "HOSPITAL")).toBe(true);
    expect(canAccess("HOSPITAL", "LABORATORY")).toBe(true);
    expect(canAccess("HOSPITAL", "DIAGNOSTIC")).toBe(true);
  });

  it("restricts laboratories to the laboratory module", () => {
    expect(canAccess("LABORATORY", "LABORATORY")).toBe(true);
    expect(canAccess("LABORATORY", "HOSPITAL")).toBe(false);
    expect(canAccess("LABORATORY", "DIAGNOSTIC")).toBe(false);
  });

  it("restricts diagnostic centres to the diagnostic module", () => {
    expect(canAccess("DIAGNOSTIC_CENTRE", "DIAGNOSTIC")).toBe(true);
    expect(canAccess("DIAGNOSTIC_CENTRE", "HOSPITAL")).toBe(false);
    expect(canAccess("DIAGNOSTIC_CENTRE", "LABORATORY")).toBe(false);
  });
});

describe("resource access matrix (spec section 7)", () => {
  it("lets hospitals see patient data, admissions, lab and diagnostic records", () => {
    expect(accessTo("HOSPITAL", "PATIENT_REGISTRATION")).toBe("FULL");
    expect(accessTo("HOSPITAL", "ADMISSION_RECORDS")).toBe("FULL");
    expect(accessTo("HOSPITAL", "LAB_ORDERS")).toBe("FULL");
    expect(accessTo("HOSPITAL", "DIAGNOSTIC_REPORTS")).toBe("FULL");
    expect(accessTo("HOSPITAL", "DISCHARGE_SUMMARIES")).toBe("FULL");
  });

  it("gives laboratories minimum patient data and no hospital charts", () => {
    expect(accessTo("LABORATORY", "PATIENT_REGISTRATION")).toBe("MINIMUM");
    expect(accessTo("LABORATORY", "LAB_ORDERS")).toBe("FULL");
    expect(accessTo("LABORATORY", "LAB_RESULTS")).toBe("FULL");
    expect(accessTo("LABORATORY", "ADMISSION_RECORDS")).toBe("NONE");
    expect(accessTo("LABORATORY", "OUTPATIENT_RECORDS")).toBe("NONE");
    expect(accessTo("LABORATORY", "INPATIENT_RECORDS")).toBe("NONE");
    expect(accessTo("LABORATORY", "DIAGNOSTIC_REPORTS")).toBe("NONE");
    expect(accessTo("LABORATORY", "DIAGNOSTIC_IMAGES")).toBe("NONE");
    expect(accessTo("LABORATORY", "DISCHARGE_SUMMARIES")).toBe("NONE");
    expect(accessTo("LABORATORY", "TREATMENT_PLANS")).toBe("NONE");
  });

  it("gives diagnostic centres minimum patient data and no lab or hospital records", () => {
    expect(accessTo("DIAGNOSTIC_CENTRE", "PATIENT_REGISTRATION")).toBe("MINIMUM");
    expect(accessTo("DIAGNOSTIC_CENTRE", "DIAGNOSTIC_REFERRALS")).toBe("FULL");
    expect(accessTo("DIAGNOSTIC_CENTRE", "DIAGNOSTIC_REPORTS")).toBe("FULL");
    expect(accessTo("DIAGNOSTIC_CENTRE", "LAB_ORDERS")).toBe("NONE");
    expect(accessTo("DIAGNOSTIC_CENTRE", "LAB_RESULTS")).toBe("NONE");
    expect(accessTo("DIAGNOSTIC_CENTRE", "ADMISSION_RECORDS")).toBe("NONE");
    expect(accessTo("DIAGNOSTIC_CENTRE", "INPATIENT_RECORDS")).toBe("NONE");
    expect(accessTo("DIAGNOSTIC_CENTRE", "DISCHARGE_SUMMARIES")).toBe("NONE");
  });

  it("keeps every organization inside its own audit trail", () => {
    for (const kind of ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"] as const) {
      expect(accessTo(kind, "OWN_AUDIT_LOGS")).toBe("FULL");
    }
  });

  it("maps every resource to exactly one module", () => {
    expect(Object.keys(RESOURCE_MATRIX)).toHaveLength(Object.keys(RESOURCE_MODULE).length);
    expect(RESOURCE_MODULE.LAB_ORDERS).toBe("LABORATORY");
    expect(RESOURCE_MODULE.DIAGNOSTIC_REPORTS).toBe("DIAGNOSTIC");
    expect(RESOURCE_MODULE.ADMISSION_RECORDS).toBe("HOSPITAL");
  });
});
