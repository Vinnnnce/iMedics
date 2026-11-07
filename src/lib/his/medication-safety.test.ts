import { describe, expect, it } from "vitest";
import {
  ADMINISTRATION_STATUSES, validateAdministration,
  validateInteractionRule, ruleMatches, checkInteractions, allergenNames, checkAllergy,
  buildEPrescriptionPayload, deliverEPrescription,
} from "./medication-safety";

describe("MAR administration validation", () => {
  it("accepts administration and documented non-administration statuses", () => {
    expect(validateAdministration("DISPENSED", "GIVEN")).toBe("GIVEN");
    expect(validateAdministration("SUBMITTED", "HELD")).toBe("HELD");
    expect(validateAdministration("REVIEWED", "REFUSED")).toBe("REFUSED");
    expect(validateAdministration("COMPLETED", "OMITTED")).toBe("OMITTED");
    expect(ADMINISTRATION_STATUSES).toEqual(["GIVEN", "HELD", "REFUSED", "OMITTED"]);
  });

  it("refuses MAR entries against draft or cancelled orders", () => {
    expect(() => validateAdministration("DRAFT", "GIVEN")).toThrow(/draft/i);
    expect(() => validateAdministration("CANCELLED", "GIVEN")).toThrow(/cancelled/i);
    expect(() => validateAdministration("DISPENSED", "INVENTED")).toThrow(/Unknown administration status/);
  });
});

describe("facility-configured interaction rules", () => {
  it("validates rule shape and severity", () => {
    expect(validateInteractionRule("Warfarin", "Aspirin", "WARNING")).toEqual({ medicationA: "Warfarin", medicationB: "Aspirin", severity: "WARNING" });
    expect(() => validateInteractionRule("  ", "Aspirin", "WARNING")).toThrow(/required/i);
    expect(() => validateInteractionRule("Warfarin", "warfarin", "WARNING")).toThrow(/two different/i);
    expect(() => validateInteractionRule("Warfarin", "Aspirin", "SEVERE")).toThrow(/severity/i);
  });

  it("matches rules in either direction, case-insensitively", () => {
    const rule = { medicationA: "Warfarin", medicationB: "Aspirin" };
    expect(ruleMatches(rule, "warfarin", ["Aspirin"])).toBe(true);
    expect(ruleMatches(rule, "aspirin", ["Warfarin"])).toBe(true);
    expect(ruleMatches(rule, "Ibuprofen", ["Warfarin"])).toBe(false);
    expect(ruleMatches(rule, "Warfarin", ["Paracetamol"])).toBe(false);
  });

  it("reports only configured active rules — the engine invents nothing", () => {
    const rules = [
      { medicationA: "Warfarin", medicationB: "Aspirin", severity: "WARNING", description: "Increased bleeding risk (hospital-configured example)", active: true },
      { medicationA: "Metformin", medicationB: "Contrast dye", severity: "ADVISORY", description: "Hold per hospital protocol", active: false },
    ];
    const alerts = checkInteractions("Aspirin", ["Warfarin", "Metformin"], rules);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: "INTERACTION", severity: "WARNING" });
    expect(alerts[0].between).toEqual(["Warfarin", "Aspirin"]);
  });
});

describe("allergy matching", () => {
  it("extracts allergen names from the stored JSON shape", () => {
    expect(allergenNames(["Penicillin", { name: "Latex" }, 42, null])).toEqual(["Penicillin", "Latex"]);
    expect(allergenNames("Penicillin")).toEqual([]);
    expect(allergenNames(null)).toEqual([]);
  });

  it("flags a medication containing a recorded allergen", () => {
    expect(checkAllergy("Penicillin G", ["Penicillin"])).toMatchObject({ kind: "ALLERGY", allergen: "Penicillin" });
    expect(checkAllergy("penicillin G", [{ name: "Penicillin" }])).toMatchObject({ kind: "ALLERGY" });
    // Substring matching only: a different-string family member (Amoxicillin)
    // is not flagged — the hospital records allergens it wants matched.
    expect(checkAllergy("Amoxicillin", ["Penicillin"])).toBeNull();
    expect(checkAllergy("Paracetamol", ["Penicillin"])).toBeNull();
  });
});

describe("e-prescribing boundary", () => {
  it("builds a payload snapshotting the order and patient identifiers", () => {
    const payload = buildEPrescriptionPayload({
      orderId: "order-1", facilityId: "h1", patientId: "p1", caseNumber: "C-1",
      order: { medicationName: "Amoxicillin", strength: "500 mg", dose: "1", route: "oral", frequency: "3x daily", duration: "7 days", notes: null, prescriberId: "d1", status: "SUBMITTED" },
    });
    expect(payload.order).toMatchObject({ id: "order-1", medicationName: "Amoxicillin", status: "SUBMITTED" });
    expect(payload.patient).toEqual({ id: "p1", caseNumber: "C-1" });
    expect(payload.facilityId).toBe("h1");
    expect(typeof payload.enqueuedAt).toBe("string");
  });

  it("stays PENDING without a configured endpoint — never claims transmission", async () => {
    const result = await deliverEPrescription(undefined, {} as never);
    expect(result).toEqual({ delivered: false, error: expect.stringContaining("EPRESCRIBING_ENDPOINT") });
  });

  it("records endpoint failures without throwing", async () => {
    const failing = async () => { throw new Error("connection refused"); };
    const result = await deliverEPrescription("https://example.test/rx", {} as never, failing as unknown as typeof fetch);
    expect(result).toEqual({ delivered: false, error: "connection refused" });
    const ok = (async () => new Response(null, { status: 202 })) as unknown as typeof fetch;
    const delivered = await deliverEPrescription("https://example.test/rx", {} as never, ok);
    expect(delivered).toEqual({ delivered: true });
  });
});
