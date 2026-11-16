import type { LetterheadView } from "@/lib/letterheads";
import { loadSignatureImageBytes } from "@/lib/letterhead-signature";
import { renderDocumentsPdf } from "./pdf";
import type { DocumentView } from "./documents";
import { parseDefinition } from "./template-schema";

/**
 * Renders a one-page sample clinical document under a letterhead so facility
 * managers and doctors can proof their branding before approving it. The
 * sample is clearly labelled as a preview and carries no patient data.
 */
export async function renderLetterheadPreviewPdf(letterhead: LetterheadView): Promise<Uint8Array> {
  // Department-scoped letterheads (e.g. Radiology) preview with their own department.
  const department = letterhead.department ?? "General medicine";
  const definition = parseDefinition({
    sections: [{
      id: "preview",
      title: "Preview — examination findings",
      fields: [
        { id: "note", label: "Clinical note", type: "textarea" },
        { id: "measurements", label: "Measurements", type: "table", columns: ["Parameter", "Value"] },
        { id: "verified", label: "Findings verified", type: "checkbox" },
      ],
    }],
    signatures: [],
  });
  const view: DocumentView = {
    id: "preview",
    documentNumber: "PREVIEW-000000",
    title: "Letterhead preview — sample document",
    groupCode: "P", groupTitle: "Preview", status: "FINAL", statusLabel: "Final",
    watermark: null, sensitivity: "STANDARD", revision: 1, templateName: "Letterhead preview", templateVersion: 1,
    department, createdAt: new Date().toISOString(), finalizedAt: new Date().toISOString(), reviewedAt: null, reviewedByName: null,
    releasedToPatientAt: null, contentHash: "0".repeat(64), amendmentReason: null, supersedes: null, supersededBy: null,
    author: { id: "preview", name: "Preview author" },
    facility: {
      name: letterhead.displayName,
      letterhead: letterhead.headerLines,
      address: letterhead.addressLine,
      contact: [letterhead.contactPhone, letterhead.contactEmail].filter(Boolean).join(" · ") || null,
      footer: letterhead.footerText,
      pageSize: "A4", logoUrl: letterhead.logoUrl, prefix: "PREVIEW",
      brandColor: letterhead.brandColor,
      registrationInfo: letterhead.registrationInfo,
      website: letterhead.website,
      showQr: letterhead.showQr,
      signatureBlocks: letterhead.signatureBlocks,
      signatureImageKey: letterhead.signatureUrl,
    },
    patient: { id: "preview", name: "Sample Patient", caseNumber: "PREVIEW-000", dateOfBirth: "1990-01-01", gender: "OTHER" },
    encounterNumber: null,
    definition,
    content: {},
    sections: [{
      id: "preview", title: "Preview — examination findings",
      fields: [
        { id: "note", label: "Clinical note", type: "textarea", value: "This is a synthetic preview document. It contains no patient data and is not a clinical record." },
        { id: "measurements", label: "Measurements", type: "table", value: [["Sample measurement", "1 mg"]], columns: ["Parameter", "Value"] },
        { id: "verified", label: "Findings verified", type: "checkbox", value: true },
      ],
    }],
    signatures: [],
    missingSignatureLabels: [],
    events: [],
  };
  // The uploaded handwritten signature image (if any) is printed above the
  // signature line so owners can proof it together with the rest.
  const signatureImages: Record<string, Uint8Array> = {};
  const bytes = await loadSignatureImageBytes(letterhead.signatureUrl);
  if (bytes) signatureImages[letterhead.signatureUrl as string] = bytes;
  return renderDocumentsPdf([view], { signatureImages });
}
