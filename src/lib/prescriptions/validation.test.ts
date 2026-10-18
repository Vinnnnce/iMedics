import { describe, expect, it } from "vitest";
import {
  createPrescriptionSchema,
  prescriptionItemSchema,
  FREQUENCY_PRESETS,
  SCHEDULE_SLOTS,
} from "./validation";

/** Structured prescription validation. */

const validItem = {
  drugName: "Amoxicillin",
  activeIngredient: "amoxicillin",
  antibioticClass: "Penicillins",
  antimicrobialSpectrum: ["GRAM_POSITIVE"],
  coverageNotes: "Covers susceptible streptococci; not reliable for MRSA.",
  route: "oral",
  formulation: "capsule",
  strength: "500 mg",
  doseValue: 500,
  doseUnit: "mg",
  frequency: "3x daily",
  frequencyText: "Three times daily",
  schedule: ["08:00", "14:00", "20:00"],
  duration: "5 days",
  quantity: 15,
  refills: 0,
  missedDoseInstructions: "Take the missed dose unless the next one is due within 2 hours.",
};

describe("prescriptionItemSchema", () => {
  it("accepts a fully structured item and applies defaults", () => {
    const parsed = prescriptionItemSchema.parse(validItem);
    expect(parsed.drugName).toBe("Amoxicillin");
    expect(parsed.antimicrobialSpectrum).toEqual(["GRAM_POSITIVE"]);
    expect(parsed.schedule).toEqual(["08:00", "14:00", "20:00"]);
  });

  it("rejects an empty drug name", () => {
    expect(prescriptionItemSchema.safeParse({ ...validItem, drugName: "  " }).success).toBe(false);
  });

  it("rejects invalid route and dose units", () => {
    expect(prescriptionItemSchema.safeParse({ ...validItem, route: "transdermal" }).success).toBe(false);
    expect(prescriptionItemSchema.safeParse({ ...validItem, doseUnit: "tablespoons" }).success).toBe(false);
  });

  it("rejects 12-hour-clock and malformed schedule times", () => {
    expect(prescriptionItemSchema.safeParse({ ...validItem, schedule: ["8:00"] }).success).toBe(false);
    expect(prescriptionItemSchema.safeParse({ ...validItem, schedule: ["08:60"] }).success).toBe(false);
    expect(prescriptionItemSchema.safeParse({ ...validItem, schedule: ["23:59"] }).success).toBe(true);
  });

  it("caps spectrum tags and schedule slots at 8", () => {
    const eight = Array.from({ length: 9 }, () => "X");
    expect(prescriptionItemSchema.safeParse({ ...validItem, antimicrobialSpectrum: eight }).success).toBe(false);
    expect(prescriptionItemSchema.safeParse({ ...validItem, schedule: Array.from({ length: 9 }, (_, i) => `0${i}:00`) }).success).toBe(false);
  });

  it("rejects a non-positive or absurd dose value", () => {
    expect(prescriptionItemSchema.safeParse({ ...validItem, doseValue: 0 }).success).toBe(false);
    expect(prescriptionItemSchema.safeParse({ ...validItem, doseValue: 1_000_000 }).success).toBe(false);
  });
});

describe("createPrescriptionSchema", () => {
  const valid = {
    patientId: "4f9d7a3e-1c2b-4a6d-8e3f-9c0b2a1d5e7f",
    items: [validItem],
    safetyAcknowledged: true,
  };

  it("requires at least one item", () => {
    expect(createPrescriptionSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
  });

  it("requires an explicit safety acknowledgement flag", () => {
    const rest: Partial<typeof valid> = { ...valid };
    delete rest.safetyAcknowledged;
    expect(createPrescriptionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an end date before the start date", () => {
    const bad = {
      ...valid,
      items: [{ ...validItem, startDate: "2026-10-18", endDate: "2026-10-17" }],
    };
    expect(createPrescriptionSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts an end date on or after the start date", () => {
    const ok = {
      ...valid,
      items: [{ ...validItem, startDate: "2026-10-18", endDate: "2026-10-23" }],
    };
    expect(createPrescriptionSchema.safeParse(ok).success).toBe(true);
  });
});

describe("reference constants", () => {
  it("exposes frequency presets including PRN", () => {
    expect(FREQUENCY_PRESETS.some((p) => p.value === "PRN")).toBe(true);
  });

  it("exposes standard schedule slots in 24-hour format", () => {
    for (const slot of SCHEDULE_SLOTS) {
      expect(slot.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
  });
});
