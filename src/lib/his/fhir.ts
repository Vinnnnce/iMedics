import { randomUUID } from "node:crypto";
import type { DocumentView } from "./documents";

/**
 * FHIR R4 collection export, not a FHIR server or an IHE/MHD certification.
 * Attachments remain behind the normal authenticated PDF route. The source
 * SHA-256 is NOT represented as FHIR Attachment.hash (which is a file hash).
 */
export function documentFhirBundle(view: DocumentView, pdfUrl: string, now = new Date()) {
  if (!["FINAL", "AMENDED"].includes(view.status)) throw new Error("Only finalized documents can be exported");
  if (!view.finalizedAt) throw new Error("A finalized timestamp is required");
  const patientUrl = `urn:uuid:${view.patient.id}`;
  const documentUrl = `urn:uuid:${view.id}`;
  const provenanceId = randomUUID();
  const superseded = Boolean(view.supersededBy && ["FINAL", "AMENDED"].includes(view.supersededBy.status));
  const security = { system: "http://terminology.hl7.org/CodeSystem/v3-Confidentiality", code: view.sensitivity === "SPECIALLY_PROTECTED" ? "V" : view.sensitivity === "RESTRICTED" ? "R" : "N" };
  return {
    resourceType: "Bundle", id: randomUUID(), type: "collection", timestamp: now.toISOString(),
    meta: { security: [security] },
    entry: [
      { fullUrl: patientUrl, resource: {
        resourceType: "Patient", id: view.patient.id,
        identifier: [{ system: "urn:imedics:case-number", value: view.patient.caseNumber }],
        name: [{ text: view.patient.name }], birthDate: view.patient.dateOfBirth.slice(0, 10),
        gender: ["male", "female", "other", "unknown"].includes(view.patient.gender.toLowerCase()) ? view.patient.gender.toLowerCase() : "unknown",
      } },
      { fullUrl: documentUrl, resource: {
        resourceType: "DocumentReference", id: view.id, meta: { security: [security] },
        identifier: [{ system: "urn:imedics:clinical-document", value: view.id }],
        status: superseded ? "superseded" : "current", docStatus: view.status === "AMENDED" ? "amended" : "final",
        type: { text: view.templateName }, category: [{ text: view.groupTitle }],
        subject: { reference: patientUrl }, date: view.finalizedAt,
        author: [{ identifier: { system: "urn:imedics:user", value: view.author.id }, display: view.author.name }],
        custodian: { display: view.facility.name }, description: view.title,
        ...(view.supersedes ? { relatesTo: [{ code: "replaces", target: { identifier: { system: "urn:imedics:clinical-document", value: view.supersedes.id } } }] } : {}),
        content: [{ attachment: { contentType: "application/pdf", url: pdfUrl, title: view.title, creation: view.finalizedAt } }],
        ...(view.contentHash ? { extension: [{ url: "urn:imedics:source-content-sha256", valueString: view.contentHash }] } : {}),
      } },
      { fullUrl: `urn:uuid:${provenanceId}`, resource: {
        resourceType: "Provenance", id: provenanceId, target: [{ reference: documentUrl }], recorded: now.toISOString(),
        occurredDateTime: view.finalizedAt,
        activity: { text: "Authenticated export of a finalized clinical document; no cryptographic signature certification asserted" },
        agent: [{ who: { identifier: { system: "urn:imedics:user", value: view.author.id }, display: view.author.name } }],
      } },
    ],
  };
}
