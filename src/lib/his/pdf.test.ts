import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderDocumentsPdf } from "./pdf";
import type { DocumentView } from "./documents";
import { parseDefinition } from "./template-schema";

const view = (status: DocumentView["status"], signed: boolean): DocumentView => ({
  id: "d1", documentNumber: "DOC-2026-000001", title: "Résumé de sortie — Выписка", groupCode: "O", groupTitle: "Discharge", status, statusLabel: status,
  watermark: status === "FINAL" ? null : "DRAFT — NOT A VALID CLINICAL RECORD", sensitivity: "STANDARD", revision: 1, templateName: "Final discharge summary", templateVersion: 1,
  department: "Médecine interne", createdAt: "2026-01-01T00:00:00Z", finalizedAt: status === "FINAL" ? "2026-01-02T00:00:00Z" : null, reviewedAt: null, reviewedByName: null,
  releasedToPatientAt: null, contentHash: status === "FINAL" ? "a".repeat(64) : null, amendmentReason: null, supersedes: null, supersededBy: null,
  author: { id: "u1", name: "Dr. Ada Ọbáfẹ́mi" },
  facility: { name: "Synthetic General Hospital", letterhead: ["Department of Medicine"], address: "1 Test Road", contact: null, footer: "Confidential", pageSize: "A4", logoUrl: null, prefix: "DOC" },
  patient: { id: "p1", name: "Test Patient", caseNumber: "MED1905-TEST", dateOfBirth: "1990-01-01", gender: "FEMALE" }, encounterNumber: "ENC-2026-000001",
  definition: parseDefinition({ sections: [{ id: "s", title: "Course", fields: [{ id: "c", label: "Hospital course", type: "textarea" }, { id: "m", label: "Medications", type: "table", columns: ["Drug", "Dose"] }] }] }),
  content: {}, sections: [{ id: "s", title: "Course", fields: [{ id: "c", label: "Hospital course", type: "textarea", value: "Synthetic text ".repeat(400) }, { id: "m", label: "Medications", type: "table", value: [["Paracétamol", "1 g"]], columns: ["Drug", "Dose"] }] }],
  signatures: signed ? [{ id: "sig-1234567", role: "AUTHOR", method: "AUTHENTICATED_ELECTRONIC", signerName: "Dr. Ada Ọbáfẹ́mi", signerTitle: "Consultant", registrationId: "MDCN-1", relationship: null, signedAt: "2026-01-02T00:00:00Z", valid: true, revokedAt: null }] : [],
  missingSignatureLabels: signed ? [] : ["Responsible clinician (author)"], events: [],
});

describe("PDF rendering", () => {
  it("renders Unicode text across multiple pages with page numbers", async () => {
    const bytes = await renderDocumentsPdf([view("FINAL", true)]);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
  it("builds a records package with an index page", async () => {
    const one = await PDFDocument.load(await renderDocumentsPdf([view("FINAL", true)]));
    const pkg = await PDFDocument.load(await renderDocumentsPdf([view("FINAL", true), view("FINAL", true)], { manifestTitle: "Package" }));
    expect(pkg.getPageCount()).toBe(one.getPageCount() * 2 + 1);
  });
  it("renders unsigned drafts without failing", async () => {
    const bytes = await renderDocumentsPdf([view("DRAFT", false)]);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
