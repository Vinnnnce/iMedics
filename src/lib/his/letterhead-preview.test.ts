import { describe, expect, it } from "vitest";
import { renderLetterheadPreviewPdf } from "./letterhead-preview";
import type { LetterheadView } from "@/lib/letterheads";

const view = (overrides: Partial<LetterheadView> = {}): LetterheadView => ({
  displayName: "Radiology Institute",
  headerLines: ["Department of Radiology", "Referral & Teaching Hospital"],
  addressLine: "12 Example Road, Example City",
  contactPhone: "+49 911 000 000",
  contactEmail: "radiology@example.org",
  website: "https://example.org",
  registrationInfo: "Registered hospital QA-000",
  brandColor: "#1D4ED8",
  footerText: "Confidential — synthetic preview",
  logoUrl: null,
  signatureUrl: null,
  showQr: true,
  signatureBlocks: [
    { name: "Dr. Ada Example", title: "Consultant Radiologist", registrationId: "MDCN-1", side: "left" },
    { name: "Dr. Ben Sample", title: "Head of Radiology", registrationId: "MDCN-2", side: "right" },
  ],
  ...overrides,
});

describe("letterhead preview PDF", () => {
  it("renders a sample document under the letterhead branding", async () => {
    const bytes = await renderLetterheadPreviewPdf(view());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    // QR enabled → an embedded image object is present.
    expect((Buffer.from(bytes).toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length).toBeGreaterThanOrEqual(1);
  });
  it("omits the QR when the letterhead disables it", async () => {
    const bytes = await renderLetterheadPreviewPdf(view({ showQr: false }));
    expect((Buffer.from(bytes).toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length).toBe(0);
  });
  it("renders with no signature blocks and no header lines without failing", async () => {
    const bytes = await renderLetterheadPreviewPdf(view({ headerLines: [], signatureBlocks: [] }));
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
