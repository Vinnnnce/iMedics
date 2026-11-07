import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

/**
 * Patient-level FHIR R4 export of the unified electronic case file.
 *
 * A collection bundle built from live records — the same data the case file
 * page renders: identification, allergies and chronic conditions from the
 * latest medical history, consultations, laboratory results, prescriptions
 * and admissions. Like the clinical-document export this is a document
 * exchange, not a FHIR server; identifiers use stable urn:uuid references
 * and the case number system.
 */

type Patient = Prisma.PatientGetPayload<object>;
type History = Prisma.MedicalHistoryGetPayload<object>;
type LabResult = Prisma.LabResultGetPayload<{ include: { values: true } }>;
type Prescription = Prisma.PrescriptionGetPayload<{ include: { items: true } }>;
type Consultation = Prisma.ConsultationGetPayload<object>;
type Admission = Prisma.AdmissionGetPayload<object>;

/** A FHIR R4 collection bundle (the subset this export produces). */
export interface FhirCollectionBundle {
  resourceType: "Bundle";
  id: string;
  type: "collection";
  timestamp: string;
  entry: { fullUrl: string; resource: Record<string, unknown> }[];
}

export interface CaseFileFhirInput {
  patient: Patient;
  latestHistory: History | null;
  labResults: LabResult[];
  prescriptions: Prescription[];
  consultations: Consultation[];
  admissions: Admission[];
}

/** Display text from the loosely-structured JSON lists on a medical history. */
function jsonLabels(value: unknown, keys: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      item && typeof item === "object"
        ? keys.map((k) => (item as Record<string, unknown>)[k]).find((v) => typeof v === "string" && v)
        : null,
    )
    .filter((v): v is string => typeof v === "string");
}

export function patientCaseFileFhirBundle(input: CaseFileFhirInput, now = new Date()): FhirCollectionBundle {
  const { patient } = input;
  const patientUrl = `urn:uuid:${patient.id}`;
  const iso = (d: Date | string) => new Date(d).toISOString();
  const date = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

  // Emergency contact, when recorded.
  const emergencyContact = patient.ecName
    ? { contact: [{ name: { text: patient.ecName }, ...(patient.ecPhone ? { telecom: [{ system: "phone", value: patient.ecPhone }] } : {}) }] }
    : {};
  const entries: FhirCollectionBundle["entry"] = [
    {
      fullUrl: patientUrl,
      resource: {
        resourceType: "Patient",
        id: patient.id,
        identifier: [{ system: "urn:imedics:case-number", value: patient.caseNumber }],
        name: [{ text: [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(" ") }],
        birthDate: date(patient.dateOfBirth),
        gender: ["male", "female", "other", "unknown"].includes(patient.gender.toLowerCase())
          ? patient.gender.toLowerCase()
          : "unknown",
        ...emergencyContact,
      },
    },
  ];

  // Allergies and chronic conditions from the latest recorded medical history.
  for (const allergen of jsonLabels(input.latestHistory?.allergies, ["allergen", "name"])) {
    const id = randomUUID();
    entries.push({
      fullUrl: `urn:uuid:${id}`,
      resource: {
        resourceType: "AllergyIntolerance",
        id,
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] },
        code: { text: allergen },
        patient: { reference: patientUrl },
        ...(input.latestHistory ? { recordedDate: date(input.latestHistory.createdAt) } : {}),
      },
    });
  }
  for (const condition of jsonLabels(input.latestHistory?.pastHistory, ["diagnosis", "condition", "name"])) {
    const id = randomUUID();
    entries.push({
      fullUrl: `urn:uuid:${id}`,
      resource: {
        resourceType: "Condition",
        id,
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
        code: { text: condition },
        subject: { reference: patientUrl },
        ...(input.latestHistory ? { recordedDate: date(input.latestHistory.createdAt) } : {}),
      },
    });
  }

  // Consultations as finished encounters.
  for (const c of input.consultations) {
    const id = randomUUID();
    entries.push({
      fullUrl: `urn:uuid:${id}`,
      resource: {
        resourceType: "Encounter",
        id,
        identifier: [{ system: "urn:imedics:consultation", value: c.id }],
        status: c.status === "FINALIZED" ? "finished" : "planned",
        class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
        subject: { reference: patientUrl },
        period: { start: iso(c.createdAt) },
        ...(c.chiefComplaint ? { reason: [{ text: c.chiefComplaint }] } : {}),
        ...(c.diagnosis ? { diagnosis: [{ condition: { text: c.diagnosis } }] } : {}),
      },
    });
  }

  // Laboratory results as observations grouped by report.
  for (const r of input.labResults) {
    for (const v of r.values) {
      const id = randomUUID();
      entries.push({
        fullUrl: `urn:uuid:${id}`,
        resource: {
          resourceType: "Observation",
          id,
          status: r.status === "VERIFIED" ? "final" : "preliminary",
          code: { text: v.name, ...(v.code ? { coding: [{ system: "http://loinc.org", code: v.code, display: v.name }] } : {}) },
          subject: { reference: patientUrl },
          effectiveDateTime: iso(r.testDate),
          ...(v.numericValue != null
            ? {
                valueQuantity: {
                  value: v.numericValue,
                  ...(v.unit ? { unit: v.unit, system: "http://unitsofmeasure.org", code: v.unit } : {}),
                },
              }
            : { valueString: v.value }),
          ...(v.refLow != null || v.refHigh != null
            ? { referenceRange: [{ ...(v.refLow != null ? { low: { value: v.refLow } } : {}), ...(v.refHigh != null ? { high: { value: v.refHigh } } : {}) }] }
            : {}),
        },
      });
    }
  }

  // Prescriptions as medication requests.
  for (const p of input.prescriptions) {
    for (const item of p.items) {
      const id = randomUUID();
      const instruction = [item.dose, item.frequency, item.duration].filter(Boolean).join(" ");
      entries.push({
        fullUrl: `urn:uuid:${id}`,
        resource: {
          resourceType: "MedicationRequest",
          id,
          status: p.status === "ACTIVE" ? "active" : "completed",
          intent: "order",
          medicationCodeableConcept: { text: item.drugName },
          subject: { reference: patientUrl },
          authoredOn: iso(p.issuedAt),
          ...(instruction ? { dosageInstruction: [{ text: instruction }] } : {}),
        },
      });
    }
  }

  // Admissions as inpatient encounters.
  for (const a of input.admissions) {
    const id = randomUUID();
    entries.push({
      fullUrl: `urn:uuid:${id}`,
      resource: {
        resourceType: "Encounter",
        id,
        identifier: [{ system: "urn:imedics:admission", value: a.id }],
        status: a.dischargeDate ? "finished" : a.status === "ACTIVE" ? "in-progress" : "finished",
        class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "IMP", display: "inpatient encounter" },
        subject: { reference: patientUrl },
        period: { start: iso(a.admissionDate), ...(a.dischargeDate ? { end: iso(a.dischargeDate) } : {}) },
        ...(a.reason ? { reason: [{ text: a.reason }] } : {}),
      },
    });
  }

  return {
    resourceType: "Bundle",
    id: randomUUID(),
    type: "collection",
    timestamp: now.toISOString(),
    entry: entries,
  } satisfies FhirCollectionBundle;
}
