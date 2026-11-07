import { describe, expect, it } from "vitest";
import type { CaseFileFhirInput } from "./patient-bundle";
import { patientCaseFileFhirBundle } from "./patient-bundle";

const patient = {
  id: "11111111-1111-4111-8111-111111111111",
  caseNumber: "MED-2026-000001",
  firstName: "Synthetic",
  middleName: null,
  lastName: "Patient",
  gender: "FEMALE",
  dateOfBirth: new Date("1990-01-01T00:00:00Z"),
  ecName: "Synthetic contact",
  ecPhone: "+1234567",
} as unknown as CaseFileFhirInput["patient"];

const latestHistory = {
  id: "22222222-2222-4222-8222-222222222222",
  patientId: patient.id,
  allergies: [{ allergen: "Penicillin" }, { name: "Latex" }],
  pastHistory: [{ diagnosis: "Hypertension" }],
  medications: [],
  createdAt: new Date("2026-10-01T00:00:00Z"),
} as unknown as CaseFileFhirInput["latestHistory"];

const labResult = {
  id: "33333333-3333-4333-8333-333333333333",
  patientId: patient.id,
  panelType: "CBC",
  testDate: new Date("2026-10-02T00:00:00Z"),
  status: "VERIFIED",
  values: [
    { id: "v1", code: "6690-2", name: "White blood cells", value: "6.8", numericValue: 6.8, unit: "10^3/uL", refLow: 4.5, refHigh: 11.0 },
  ],
} as unknown as CaseFileFhirInput["labResults"][number];

const prescription = {
  id: "44444444-4444-4444-8444-444444444444",
  patientId: patient.id,
  status: "ACTIVE",
  issuedAt: new Date("2026-10-03T00:00:00Z"),
  items: [{ id: "i1", drugName: "Amlodipine", dose: "5 mg", frequency: "once daily", duration: "30 days" }],
} as unknown as CaseFileFhirInput["prescriptions"][number];

const consultation = {
  id: "55555555-5555-4555-8555-555555555555",
  patientId: patient.id,
  status: "FINALIZED",
  chiefComplaint: "Headache",
  diagnosis: "Hypertension, uncontrolled",
  createdAt: new Date("2026-10-04T00:00:00Z"),
} as unknown as CaseFileFhirInput["consultations"][number];

const admission = {
  id: "66666666-6666-4666-8666-666666666666",
  patientId: patient.id,
  status: "ACTIVE",
  admissionDate: new Date("2026-10-05T00:00:00Z"),
  dischargeDate: null,
  reason: "Chest pain",
} as unknown as CaseFileFhirInput["admissions"][number];

const input: CaseFileFhirInput = {
  patient,
  latestHistory,
  labResults: [labResult],
  prescriptions: [prescription],
  consultations: [consultation],
  admissions: [admission],
};

describe("patient case file FHIR R4 export", () => {
  it("builds a collection bundle with every case-file section as a resource", () => {
    const bundle = patientCaseFileFhirBundle(input, new Date("2026-10-30T13:00:00Z"));
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("collection");
    expect(bundle.timestamp).toBe("2026-10-30T13:00:00.000Z");
    const types = bundle.entry.map((e) => e.resource.resourceType);
    expect(types[0]).toBe("Patient");
    expect(types).toContain("AllergyIntolerance");
    expect(types).toContain("Condition");
    expect(types).toContain("Encounter");
    expect(types).toContain("Observation");
    expect(types).toContain("MedicationRequest");
  });

  it("identifies the patient by case number and links resources to them", () => {
    const bundle = patientCaseFileFhirBundle(input);
    const patientEntry = bundle.entry[0];
    expect(patientEntry.resource).toMatchObject({
      resourceType: "Patient",
      identifier: [{ system: "urn:imedics:case-number", value: "MED-2026-000001" }],
      birthDate: "1990-01-01",
      gender: "female",
    });
    const ownerRefs = bundle.entry.slice(1).map(
      (e) =>
        (e.resource.subject as { reference?: string } | undefined)?.reference ??
        (e.resource.patient as { reference?: string } | undefined)?.reference,
    );
    expect(ownerRefs.every((r) => r === patientEntry.fullUrl)).toBe(true);
  });

  it("maps allergies and conditions with recorded dates", () => {
    const bundle = patientCaseFileFhirBundle(input);
    const allergy = bundle.entry.find((e) => e.resource.resourceType === "AllergyIntolerance")!.resource as Record<string, never>;
    expect(allergy.code).toMatchObject({ text: "Penicillin" });
    expect(allergy.recordedDate).toBe("2026-10-01");
    const condition = bundle.entry.find((e) => e.resource.resourceType === "Condition")!.resource as Record<string, never>;
    expect(condition.code).toMatchObject({ text: "Hypertension" });
  });

  it("maps lab values to observations with LOINC codes, quantities and reference ranges", () => {
    const bundle = patientCaseFileFhirBundle(input);
    const obs = bundle.entry.find((e) => e.resource.resourceType === "Observation")!.resource as Record<string, never>;
    expect(obs).toMatchObject({
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "6690-2", display: "White blood cells" }] },
      valueQuantity: { value: 6.8, unit: "10^3/uL" },
      referenceRange: [{ low: { value: 4.5 }, high: { value: 11 } }],
    });
  });

  it("maps prescriptions to medication requests with dosage instructions", () => {
    const bundle = patientCaseFileFhirBundle(input);
    const med = bundle.entry.find((e) => e.resource.resourceType === "MedicationRequest")!.resource as Record<string, never>;
    expect(med).toMatchObject({
      status: "active",
      intent: "order",
      medicationCodeableConcept: { text: "Amlodipine" },
      dosageInstruction: [{ text: "5 mg once daily 30 days" }],
    });
  });

  it("maps consultations to finished ambulatory encounters with diagnosis", () => {
    const bundle = patientCaseFileFhirBundle(input);
    const encounters = bundle.entry.filter((e) => e.resource.resourceType === "Encounter");
    expect(encounters).toHaveLength(2);
    const amb = encounters.find((e) => (e.resource.class as { code?: string } | undefined)?.code === "AMB")!.resource;
    expect(amb).toMatchObject({ status: "finished", reason: [{ text: "Headache" }] });
    const imp = encounters.find((e) => (e.resource.class as { code?: string } | undefined)?.code === "IMP")!.resource;
    expect(imp).toMatchObject({ status: "in-progress", period: { start: "2026-10-05T00:00:00.000Z" } });
  });

  it("uses unique fullUrl values for every entry", () => {
    const bundle = patientCaseFileFhirBundle(input);
    expect(new Set(bundle.entry.map((e) => e.fullUrl)).size).toBe(bundle.entry.length);
  });
});
