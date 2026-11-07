/**
 * Tests for the registration domain logic: duplicate scoring, BMI/age
 * helpers, minor detection and consent policy enforcement.
 */
import { describe, expect, it } from "vitest";
import {
  scoreDuplicate,
  computeBmi,
  computeAge,
  isMinor,
  validateConsents,
  admissionTypeConfig,
  CONSENT_CATALOGUE,
  type NewPatientInput,
} from "./registration";

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    caseNumber: "MC-TEST0001",
    firstName: "Ada",
    lastName: "Obi",
    middleName: null,
    gender: "FEMALE",
    dateOfBirth: new Date("1990-04-12T00:00:00.000Z"),
    phone: "+2348012345678",
    email: "ada@example.com",
    identityNumber: null,
    insuranceNumber: null,
    unidentified: false,
    ...overrides,
  };
}

const newData = (overrides: Partial<NewPatientInput> = {}): NewPatientInput => ({
  firstName: "Ada",
  lastName: "Obi",
  dateOfBirth: "1990-04-12",
  gender: "FEMALE",
  identityVerified: false,
  emergencyContacts: [],
  ...overrides,
} as NewPatientInput);

describe("scoreDuplicate", () => {
  it("flags same name + DOB + phone as a high-confidence possible duplicate", () => {
    const m = scoreDuplicate(newData({ phone: "+2348012345678" }), candidate());
    expect(m.score).toBeGreaterThanOrEqual(0.9);
    expect(m.reasons).toContain("Same date of birth");
    expect(m.reasons).toContain("Same phone number");
  });

  it("keeps a partly similar name alone below the review threshold", () => {
    const m = scoreDuplicate(newData({ lastName: "Smith" }), candidate({ phone: null, dateOfBirth: new Date("1985-01-01T00:00:00.000Z") }));
    expect(m.score).toBeLessThan(0.45);
  });

  it("catches swapped first/last names with matching DOB", () => {
    const m = scoreDuplicate(newData({ firstName: "Obi", lastName: "Ada" }), candidate());
    expect(m.score).toBeGreaterThanOrEqual(0.45);
  });

  it("marks unidentified temporary records in the review reasons", () => {
    const m = scoreDuplicate(newData(), candidate({ unidentified: true }));
    expect(m.reasons.some((r) => r.includes("Unidentified"))).toBe(true);
  });

  it("adds identity-number matches as very strong evidence", () => {
    const m = scoreDuplicate(newData({ identityNumber: "NIN-99" }), candidate({ identityNumber: "NIN-99" }));
    expect(m.score).toBeGreaterThan(0.5);
  });
});

describe("clinical helpers", () => {
  it("computes BMI from kg and cm", () => {
    expect(computeBmi({ weightKg: 70, heightCm: 175 })).toBeCloseTo(22.9, 0);
    expect(computeBmi({ weightKg: 70 })).toBeNull();
  });

  it("computes age and detects minors", () => {
    expect(isMinor("2015-01-01")).toBe(true);
    expect(isMinor("2000-01-01")).toBe(false);
    expect(computeAge("2000-06-15", new Date("2026-01-01T00:00:00Z"))).toBe(25);
  });
});

describe("consent policy", () => {
  it("requires the mandatory consents for routine registrations", () => {
    const problems = validateConsents([], { emergency: false });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toContain("General admission consent");
  });

  it("passes when all required consents are acknowledged", () => {
    const given = CONSENT_CATALOGUE.filter((c) => c.required).map((c) => ({
      key: c.key, title: c.title, version: c.version, status: "GIVEN" as const, signedByRole: "PATIENT" as const,
    }));
    expect(validateConsents(given, { emergency: false })).toEqual([]);
  });

  it("lets emergency registrations defer general admission consent", () => {
    const given = CONSENT_CATALOGUE
      .filter((c) => c.required && c.key !== "general_admission")
      .map((c) => ({ key: c.key, title: c.title, version: c.version, status: "GIVEN" as const, signedByRole: "PATIENT" as const }));
    expect(validateConsents(given, { emergency: true })).toEqual([]);
  });
});

describe("admission type config", () => {
  it("maps admission types to encounter types and inpatient flags", () => {
    expect(admissionTypeConfig("INPATIENT_PLANNED").encounterType).toBe("PLANNED_INPATIENT");
    expect(admissionTypeConfig("INPATIENT_PLANNED").inpatient).toBe(true);
    expect(admissionTypeConfig("OUTPATIENT").inpatient).toBe(false);
    expect(admissionTypeConfig("UNKNOWN").encounterType).toBe("UNSCHEDULED_OUTPATIENT");
  });
});
