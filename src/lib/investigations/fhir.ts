/**
 * HL7 FHIR R4 mappers for the investigation pipeline. Only RELEASED reports are
 * exported as final DiagnosticReports. Codes are emitted only when present and
 * the local code is always carried in a separate, clearly-local coding system:
 * no international code is ever invented.
 */
type Json = Record<string, unknown>;

export const LOCAL_CODE_SYSTEM = "https://medic1905.com/fhir/CodeSystem/investigation-catalogue";
const LOINC = "http://loinc.org";
const SNOMED = "http://snomed.info/sct";
const UCUM = "http://unitsofmeasure.org";
const DICOM_MODALITY = "http://dicom.nema.org/resources/ontology/DCM";

const ref = (type: string, id: string) => ({ reference: `${type}/${id}` });

export function codeableConcept(item: { code?: string | null; loinc?: string | null; snomed?: string | null; name: string }): Json {
  const coding: Json[] = [];
  if (item.loinc) coding.push({ system: LOINC, code: item.loinc });
  if (item.snomed) coding.push({ system: SNOMED, code: item.snomed });
  if (item.code) coding.push({ system: LOCAL_CODE_SYSTEM, code: item.code, display: item.name });
  return { coding, text: item.name };
}

const priorityMap = { ROUTINE: "routine", URGENT: "urgent", EMERGENCY: "stat" } as const;
const flagMap: Record<string, string> = { NORMAL: "N", LOW: "L", HIGH: "H", CRITICAL_LOW: "LL", CRITICAL_HIGH: "HH" };

export interface FhirItem {
  id: string; orderId: string; patientId: string; status: string; nameSnapshot: string; codeSnapshot: string | null; loincSnapshot: string | null; snomedSnapshot: string | null;
  priority: keyof typeof priorityMap; createdAt: Date; performingFacilityId: string | null; domain: "LABORATORY" | "DIAGNOSTIC"; requesterUserId: string; encounterId?: string | null; authorisedAt?: Date | null;
}

export function serviceRequest(i: FhirItem): Json {
  const status = i.status === "CANCELLED" ? "revoked" : ["RELEASED", "DELIVERED"].includes(i.status) ? "completed" : i.status === "NEW_REQUEST" ? "active" : "active";
  return {
    resourceType: "ServiceRequest", id: i.id, status, intent: "order", priority: priorityMap[i.priority],
    category: [{ coding: [{ system: SNOMED, code: i.domain === "LABORATORY" ? "108252007" : "363679005", display: i.domain === "LABORATORY" ? "Laboratory procedure" : "Imaging" }] }],
    code: codeableConcept({ code: i.codeSnapshot, loinc: i.loincSnapshot, snomed: i.snomedSnapshot, name: i.nameSnapshot }),
    subject: ref("Patient", i.patientId), authoredOn: i.createdAt.toISOString(), requester: ref("Practitioner", i.requesterUserId),
    ...(i.encounterId ? { encounter: ref("Encounter", i.encounterId) } : {}),
    ...(i.performingFacilityId ? { performer: [ref("Organization", i.performingFacilityId)] } : {}),
  };
}

export function specimen(s: { id: string; patientId: string; barcode: string; accessionNumber: string; specimenType: string | null; status: string; collectedAt: Date | null; receivedAt: Date | null; itemId: string }): Json {
  return {
    resourceType: "Specimen", id: s.id, accessionIdentifier: { system: `${LOCAL_CODE_SYSTEM}/accession`, value: s.accessionNumber },
    identifier: [{ system: `${LOCAL_CODE_SYSTEM}/barcode`, value: s.barcode }],
    status: ["REJECTED", "RECOLLECTION_REQUESTED"].includes(s.status) ? "unsatisfactory" : s.status === "PENDING_COLLECTION" ? "unavailable" : "available",
    type: s.specimenType ? { text: s.specimenType } : undefined, subject: ref("Patient", s.patientId), request: [ref("ServiceRequest", s.itemId)],
    ...(s.receivedAt ? { receivedTime: s.receivedAt.toISOString() } : {}), ...(s.collectedAt ? { collection: { collectedDateTime: s.collectedAt.toISOString() } } : {}),
  };
}

export function observation(o: { id: string; patientId: string; resultId: string; name: string; loincCode: string | null; valueNumeric: number | null; valueText: string | null; unit: string | null; refLow: number | null; refHigh: number | null; refText: string | null; flag: string | null }, issued: Date | null): Json {
  const quantity = o.valueNumeric != null ? { value: o.valueNumeric, ...(o.unit ? { unit: o.unit, system: UCUM, code: o.unit } : {}) } : undefined;
  return {
    resourceType: "Observation", id: o.id, status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
    code: { coding: o.loincCode ? [{ system: LOINC, code: o.loincCode }] : [], text: o.name },
    subject: ref("Patient", o.patientId), ...(issued ? { issued: issued.toISOString() } : {}),
    ...(quantity ? { valueQuantity: quantity } : { valueString: o.valueText ?? "" }),
    ...(o.flag ? { interpretation: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: flagMap[o.flag] }] }] } : {}),
    ...((o.refLow != null || o.refHigh != null || o.refText) ? { referenceRange: [{ ...(o.refLow != null ? { low: { value: o.refLow, ...(o.unit ? { unit: o.unit, system: UCUM, code: o.unit } : {}) } } : {}), ...(o.refHigh != null ? { high: { value: o.refHigh, ...(o.unit ? { unit: o.unit, system: UCUM, code: o.unit } : {}) } } : {}), ...(o.refText ? { text: o.refText } : {}) }] } : {}),
  };
}

export interface FhirReportInput {
  result: { id: string; itemId: string; version: number; findings: string | null; impression: string | null; conclusion: string | null; releasedAt: Date | null; signedById: string | null; reporterName: string | null };
  item: FhirItem; facilityId: string | null;
  observations: Parameters<typeof observation>[0][];
  media: { id: string; studyInstanceUid: string | null; dicomModality: string | null; mimeType: string; fileName: string }[];
}

export function diagnosticReport(r: FhirReportInput): Json[] {
  const resources: Json[] = [];
  const obsRefs = r.observations.map((o) => { resources.push(observation(o, r.result.releasedAt)); return ref("Observation", o.id); });
  const imagingStudies = new Map<string, FhirReportInput["media"]>();
  for (const m of r.media) if (m.studyInstanceUid) imagingStudies.set(m.studyInstanceUid, [...(imagingStudies.get(m.studyInstanceUid) ?? []), m]);
  const studyRefs = [...imagingStudies.entries()].map(([uid, list]) => {
    const id = `${r.result.id}-${uid.replace(/[^0-9.]/g, "").slice(-20) || "study"}`;
    resources.push({ resourceType: "ImagingStudy", id, status: "available", subject: ref("Patient", r.item.patientId), identifier: [{ system: "urn:dicom:uid", value: `urn:oid:${uid}` }],
      ...(list[0].dicomModality ? { modality: [{ system: DICOM_MODALITY, code: list[0].dicomModality }] } : {}), basedOn: [ref("ServiceRequest", r.item.id)], numberOfSeries: list.length });
    return ref("ImagingStudy", id);
  });
  const docRefs = r.media.map((m) => {
    resources.push({ resourceType: "DocumentReference", id: m.id, status: "current", subject: ref("Patient", r.item.patientId), content: [{ attachment: { contentType: m.mimeType, title: m.fileName } }] });
    return ref("DocumentReference", m.id);
  });
  resources.push({
    resourceType: "DiagnosticReport", id: r.result.id, meta: { versionId: String(r.result.version) },
    status: r.result.version > 1 ? "amended" : "final", basedOn: [ref("ServiceRequest", r.item.id)],
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: r.item.domain === "LABORATORY" ? "LAB" : "RAD" }] }],
    code: codeableConcept({ code: r.item.codeSnapshot, loinc: r.item.loincSnapshot, snomed: r.item.snomedSnapshot, name: r.item.nameSnapshot }),
    subject: ref("Patient", r.item.patientId), ...(r.result.releasedAt ? { issued: r.result.releasedAt.toISOString() } : {}),
    ...(r.facilityId ? { performer: [ref("Organization", r.facilityId)] } : {}),
    result: obsRefs, imagingStudy: studyRefs, presentedForm: [], extension: docRefs.length ? [{ url: `${LOCAL_CODE_SYSTEM}/media`, valueReference: docRefs[0] }] : undefined,
    conclusion: [r.result.impression, r.result.conclusion].filter(Boolean).join("\n") || undefined,
  });
  if (r.result.signedById) resources.push({ resourceType: "Provenance", id: `${r.result.id}-prov`, target: [ref("DiagnosticReport", r.result.id)], recorded: (r.result.releasedAt ?? new Date()).toISOString(), agent: [{ who: ref("Practitioner", r.result.signedById) }] });
  return resources;
}
