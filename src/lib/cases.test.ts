import { describe, expect, it } from "vitest";
import {
  canTransitionCareCase,
  careCaseTransitionsFrom,
  caseListWhere,
  caseTypeCode,
  derivedStatusForConsultation,
  derivedStatusForFacilityBooking,
  derivedStatusForLabOrder,
  isCareCaseType,
} from "./cases";

describe("case type codes", () => {
  it("maps every case type to a single-letter code", () => {
    expect(caseTypeCode("CONSULTATION")).toBe("C");
    expect(caseTypeCode("LABORATORY")).toBe("L");
    expect(caseTypeCode("DIAGNOSTIC")).toBe("D");
    expect(caseTypeCode("REPORT")).toBe("R");
    expect(caseTypeCode("HOSPITAL")).toBe("H");
  });

  it("recognises valid case types and rejects others", () => {
    expect(isCareCaseType("CONSULTATION")).toBe(true);
    expect(isCareCaseType("NOT_A_TYPE")).toBe(false);
    expect(isCareCaseType("")).toBe(false);
  });
});

describe("status transitions", () => {
  it("allows the expected forward paths", () => {
    expect(canTransitionCareCase("OPEN", "AWAITING_RESULT")).toBe(true);
    expect(canTransitionCareCase("AWAITING_RESULT", "RESULT_AVAILABLE")).toBe(true);
    expect(canTransitionCareCase("RESULT_AVAILABLE", "CLOSED")).toBe(true);
    expect(canTransitionCareCase("CLOSED", "ARCHIVED")).toBe(true);
  });

  it("blocks backward jumps and terminal escapes", () => {
    expect(canTransitionCareCase("RESULT_AVAILABLE", "OPEN")).toBe(false);
    expect(canTransitionCareCase("ARCHIVED", "OPEN")).toBe(false);
    expect(canTransitionCareCase("ARCHIVED", "CLOSED")).toBe(false);
  });

  it("does not allow resurrecting an archived case", () => {
    expect(careCaseTransitionsFrom("ARCHIVED")).toEqual([]);
  });

  it("keeps CLOSED cases reviewable but only via explicit transitions", () => {
    expect(canTransitionCareCase("CLOSED", "FOLLOW_UP_REQUIRED")).toBe(true);
    expect(canTransitionCareCase("CLOSED", "UNDER_REVIEW")).toBe(false);
  });
});

describe("derived statuses from existing records", () => {
  it("keeps unfinished consultations open", () => {
    expect(derivedStatusForConsultation("DRAFT", null, null)).toBe("OPEN");
    expect(derivedStatusForConsultation("FINALIZED", null, null)).toBe("OPEN");
  });

  it("closes finalised consultations without follow-up", () => {
    expect(derivedStatusForConsultation("FINALIZED", new Date(), null)).toBe("CLOSED");
  });

  it("marks finalised consultations with a future follow-up as follow-up required", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(derivedStatusForConsultation("FINALIZED", new Date(), future)).toBe("FOLLOW_UP_REQUIRED");
  });

  it("maps lab order and facility booking states mechanically", () => {
    expect(derivedStatusForLabOrder("ORDERED")).toBe("AWAITING_RESULT");
    expect(derivedStatusForLabOrder("IN_PROGRESS")).toBe("AWAITING_RESULT");
    expect(derivedStatusForLabOrder("COMPLETED")).toBe("RESULT_AVAILABLE");
    expect(derivedStatusForLabOrder("CANCELLED")).toBe("CLOSED");
    expect(derivedStatusForFacilityBooking("REQUESTED")).toBe("AWAITING_INVESTIGATION");
    expect(derivedStatusForFacilityBooking("CONFIRMED")).toBe("AWAITING_INVESTIGATION");
    expect(derivedStatusForFacilityBooking("COMPLETED")).toBe("CLOSED");
    expect(derivedStatusForFacilityBooking("CANCELLED")).toBe("CLOSED");
  });
});

describe("caseListWhere", () => {
  it("scopes every query to the requesting patient", () => {
    expect(caseListWhere("patient-1", {})).toEqual({ patientId: "patient-1" });
  });

  it("applies type and status filters", () => {
    const where = caseListWhere("p1", { type: ["LABORATORY"], status: ["AWAITING_RESULT"] });
    expect(where).toEqual({
      patientId: "p1",
      type: { in: ["LABORATORY"] },
      status: { in: ["AWAITING_RESULT"] },
    });
  });

  it("searches case numbers and clinical text case-insensitively", () => {
    const where = caseListWhere("p1", { q: "MED1905-C-2026-00001" });
    expect(where.AND).toHaveLength(1);
    const clause = (where.AND as Array<{ OR?: unknown }>)[0];
    expect(clause.OR).toHaveLength(3);
  });

  it("ignores whitespace-only search", () => {
    expect(caseListWhere("p1", { q: "   " })).toEqual({ patientId: "p1" });
  });
});
