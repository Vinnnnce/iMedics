import { describe, expect, it } from "vitest";
import type { LetterheadProfile } from "@prisma/client";
import { brandColorOf, letterheadView, signatureBlocksOf, validateLetterheadInput, DEFAULT_BRAND_COLOR } from "./letterheads";

describe("brandColorOf", () => {
  it("accepts valid hex colours", () => {
    expect(brandColorOf("#0F766E")).toBe("#0F766E");
    expect(brandColorOf("#ABCDEF")).toBe("#ABCDEF");
  });
  it("falls back to the default for anything malformed", () => {
    expect(brandColorOf(null)).toBe(DEFAULT_BRAND_COLOR);
    expect(brandColorOf(undefined)).toBe(DEFAULT_BRAND_COLOR);
    expect(brandColorOf("0F766E")).toBe(DEFAULT_BRAND_COLOR); // missing #
    expect(brandColorOf("#0f76")).toBe(DEFAULT_BRAND_COLOR); // too short
    expect(brandColorOf("teal")).toBe(DEFAULT_BRAND_COLOR);
  });
});

describe("signatureBlocksOf", () => {
  it("coerces stored JSON into validated blocks", () => {
    expect(signatureBlocksOf([
      { name: "  Dr. Ada Ọbáfẹ́mi  ", title: "Consultant", registrationId: "MDCN-1", side: "right" },
      { name: "Dr. Ben", side: "middle" },
    ])).toEqual([
      { name: "Dr. Ada Ọbáfẹ́mi", title: "Consultant", registrationId: "MDCN-1", side: "right" },
      { name: "Dr. Ben", side: "left" },
    ]);
  });
  it("drops blocks without a name and caps the count at four", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ name: `Block ${i}` }));
    expect(signatureBlocksOf(many)).toHaveLength(4);
    expect(signatureBlocksOf([{ title: "No name" }, "junk", null, { name: "Kept" }])).toEqual([{ name: "Kept" }]);
  });
  it("returns an empty list for non-arrays", () => {
    expect(signatureBlocksOf(null)).toEqual([]);
    expect(signatureBlocksOf({})).toEqual([]);
    expect(signatureBlocksOf("blocks")).toEqual([]);
  });
});

describe("validateLetterheadInput", () => {
  const base = { name: "Main letterhead", displayName: "Synthetic General Hospital" };
  it("accepts a minimal valid letterhead", () => {
    const result = validateLetterheadInput(base);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe("Main letterhead");
  });
  it("requires a name and a display name", () => {
    expect(validateLetterheadInput({ ...base, name: "  " }).ok).toBe(false);
    expect(validateLetterheadInput({ ...base, displayName: "" }).ok).toBe(false);
  });
  it("rejects malformed brand colours", () => {
    expect(validateLetterheadInput({ ...base, brandColor: "green" }).ok).toBe(false);
    expect(validateLetterheadInput({ ...base, brandColor: "#0F766E" }).ok).toBe(true);
  });
  it("rejects too many or malformed header lines", () => {
    expect(validateLetterheadInput({ ...base, headerLines: Array.from({ length: 7 }, () => "line") }).ok).toBe(false);
    expect(validateLetterheadInput({ ...base, headerLines: ["ok", ""] }).ok).toBe(true);
  });
  it("rejects signature blocks without names", () => {
    expect(validateLetterheadInput({ ...base, signatureBlocks: [{ title: "Anonymous" }] }).ok).toBe(false);
    expect(validateLetterheadInput({ ...base, signatureBlocks: [{ name: "Dr. Ada" }] }).ok).toBe(true);
  });
  it("trims and normalises the department", () => {
    const result = validateLetterheadInput({ ...base, department: "  Cardiology  " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.department).toBe("Cardiology");
    const cleared = validateLetterheadInput({ ...base, department: "   " });
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.value.department).toBeNull();
  });
});

describe("signature image keys", () => {
  const base = { name: "Main letterhead", displayName: "Synthetic General Hospital" };
  it("accepts a key inside the signature storage prefix", () => {
    const result = validateLetterheadInput({ ...base, signatureUrl: "letterhead-signatures/abc123" });
    expect(result.ok).toBe(true);
  });
  it("rejects references outside the signature storage prefix", () => {
    expect(validateLetterheadInput({ ...base, signatureUrl: "medical-media/final/x" }).ok).toBe(false);
    expect(validateLetterheadInput({ ...base, signatureUrl: "https://evil.example/sig.png" }).ok).toBe(false);
  });
  it("allows clearing the signature image with null", () => {
    expect(validateLetterheadInput({ ...base, signatureUrl: null }).ok).toBe(true);
  });
  it("surfaces the stored key on the view and drops malformed ones", () => {
    const profile = {
      id: "id", facilityId: "f", userId: null, name: "n", department: null, isDefault: true,
      displayName: "d", headerLines: [], addressLine: null, contactPhone: null, contactEmail: null,
      website: null, registrationInfo: null, brandColor: "#0F766E", footerText: null, logoUrl: null,
      signatureUrl: "letterhead-signatures/abc", showQr: true, watermark: null, signatureBlocks: [],
      active: true, createdById: "u", createdAt: new Date(), updatedAt: new Date(),
    } as LetterheadProfile;
    expect(letterheadView(profile).signatureUrl).toBe("letterhead-signatures/abc");
    expect(letterheadView({ ...profile, signatureUrl: "other-prefix/x" }).signatureUrl).toBeNull();
  });
});
