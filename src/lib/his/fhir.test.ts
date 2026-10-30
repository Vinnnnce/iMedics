import { describe, expect, it } from "vitest";
import type { DocumentView } from "./documents";
import { documentFhirBundle } from "./fhir";

const view = {
  id: "11111111-1111-4111-8111-111111111111", status: "FINAL", finalizedAt: "2026-10-30T12:00:00Z",
  sensitivity: "RESTRICTED", title: "Synthetic clinical note", templateName: "Acceptance", groupTitle: "Outpatient",
  contentHash: "a".repeat(64), supersedes: null, supersededBy: null,
  patient: { id: "22222222-2222-4222-8222-222222222222", name: "Synthetic Patient", caseNumber: "QA-TEST", dateOfBirth: "1990-01-01", gender: "OTHER" },
  author: { id: "33333333-3333-4333-8333-333333333333", name: "Synthetic author" },
  facility: { name: "Synthetic hospital" },
} as DocumentView;

describe("FHIR R4 collection export", () => {
  it("includes linked Patient, DocumentReference and Provenance resources", () => {
    const bundle = documentFhirBundle(view, "/api/protected/pdf", new Date("2026-10-30T13:00:00Z"));
    expect(bundle.type).toBe("collection");
    expect(bundle.entry.map((e) => e.resource.resourceType)).toEqual(["Patient", "DocumentReference", "Provenance"]);
    expect(new Set(bundle.entry.map((e) => e.fullUrl)).size).toBe(3);
    expect(bundle.entry[1].resource).toMatchObject({ status: "current", docStatus: "final", subject: { reference: bundle.entry[0].fullUrl } });
  });
  it("keeps protected PDF behind authentication and does not mislabel content hash as PDF hash", () => {
    const doc = documentFhirBundle(view, "/api/protected/pdf").entry[1].resource;
    expect(doc).toMatchObject({ content: [{ attachment: { url: "/api/protected/pdf", contentType: "application/pdf" } }] });
    expect(JSON.stringify(doc)).not.toContain('"hash":');
    expect(JSON.stringify(doc)).not.toContain("registrationId");
    expect(JSON.stringify(doc)).not.toContain("signedUrl");
  });
  it("marks a replaced original superseded and describes the amendment relationship", () => {
    const bundle = documentFhirBundle({ ...view, status: "AMENDED", supersededBy: { id: "new", documentNumber: "QA-NEW", status: "FINAL" }, supersedes: { id: "old", documentNumber: "QA-OLD" } }, "/api/protected/pdf");
    expect(bundle.entry[1].resource).toMatchObject({ status: "superseded", relatesTo: [{ code: "replaces", target: { identifier: { value: "old" } } }] });
  });
  it.each(["DRAFT", "PENDING_REVIEW", "PENDING_SIGNATURE", "ENTERED_IN_ERROR"] as const)("refuses %s records", (status) => {
    expect(() => documentFhirBundle({ ...view, status }, "/pdf")).toThrow();
  });
  it("refuses a final record without its finalized timestamp", () => {
    expect(() => documentFhirBundle({ ...view, finalizedAt: null }, "/pdf")).toThrow();
  });
});
