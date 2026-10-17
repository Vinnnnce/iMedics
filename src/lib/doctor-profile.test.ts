import { describe, expect, it } from "vitest";
import {
  doctorProfileUpdateSchema,
  doctorServiceInputSchema,
  portfolioItemIsPublic,
  serializeDoctorService,
  serializePublicPortfolioItem,
} from "./doctor-profile";

describe("portfolioItemIsPublic", () => {
  it("shows public non-case-study items", () => {
    expect(portfolioItemIsPublic({ visibility: "PUBLIC", consentStatus: "PENDING", type: "PUBLICATION" })).toBe(true);
  });

  it("hides private items whatever their consent state", () => {
    expect(portfolioItemIsPublic({ visibility: "PRIVATE", consentStatus: "GRANTED", type: "PUBLICATION" })).toBe(false);
  });

  it("shows a case study only with recorded granted consent", () => {
    expect(portfolioItemIsPublic({ visibility: "PUBLIC", consentStatus: "GRANTED", type: "CASE_STUDY" })).toBe(true);
    expect(portfolioItemIsPublic({ visibility: "PUBLIC", consentStatus: "PENDING", type: "CASE_STUDY" })).toBe(false);
    expect(portfolioItemIsPublic({ visibility: "PUBLIC", consentStatus: "DENIED", type: "CASE_STUDY" })).toBe(false);
  });
});

describe("doctorProfileUpdateSchema", () => {
  const base = {
    professionalTitle: null,
    qualifications: null,
    clinicalInterests: [],
    conditionsTreated: [],
    proceduresPerformed: [],
    patientCarePhilosophy: null,
    consultationApproach: null,
    whenToBookGuidance: null,
    consultationModes: [],
    linkedinUrl: null,
    linkedinPublic: false,
    cvFileId: null,
    licensingAuthority: null,
    licenseExpiry: null,
    licensePublic: false,
    professionalMemberships: [],
    awards: [],
    hospitalAffiliations: [],
  };

  it("accepts a minimal valid profile", () => {
    expect(doctorProfileUpdateSchema.parse(base)).toEqual(base);
  });

  it("treats the update as partial: omitted fields are simply absent", () => {
    const parsed = doctorProfileUpdateSchema.parse({ professionalTitle: "Consultant" });
    expect(parsed).toEqual({ professionalTitle: "Consultant" });
    expect(doctorProfileUpdateSchema.parse({})).toEqual({});
  });

  it("rejects a non-LinkedIn URL", () => {
    expect(doctorProfileUpdateSchema.safeParse({ ...base, linkedinUrl: "https://example.com/in/someone" }).success).toBe(false);
  });

  it("rejects a malformed LinkedIn URL", () => {
    expect(doctorProfileUpdateSchema.safeParse({ ...base, linkedinUrl: "linkedin.com/in/someone" }).success).toBe(false);
  });

  it("accepts country-prefixed LinkedIn URLs", () => {
    expect(doctorProfileUpdateSchema.safeParse({ ...base, linkedinUrl: "https://uk.linkedin.com/in/someone" }).success).toBe(true);
  });

  it("rejects an unknown consultation mode", () => {
    expect(doctorProfileUpdateSchema.safeParse({ ...base, consultationModes: ["SMS"] }).success).toBe(false);
  });
});

describe("doctorServiceInputSchema", () => {
  const base = {
    kind: "NEW_PATIENT",
    name: "First consultation",
    description: null,
    modes: [],
    durationMinutes: 30,
    currency: "NGN",
    price: 5000,
    followUpPrice: null,
    followUpWindowDays: null,
    isActive: true,
    icd10Codes: [],
    cancellationTerms: null,
    refundTerms: null,
    includes: [],
    addOns: [],
  };

  it("accepts a minimal valid service", () => {
    expect(doctorServiceInputSchema.parse(base)).toEqual(base);
  });

  it("requires a window when a follow-up price is set", () => {
    expect(doctorServiceInputSchema.safeParse({ ...base, followUpPrice: 2000 }).success).toBe(false);
    expect(doctorServiceInputSchema.safeParse({ ...base, followUpPrice: 2000, followUpWindowDays: 14 }).success).toBe(true);
  });

  it("rejects unsupported currencies", () => {
    expect(doctorServiceInputSchema.safeParse({ ...base, currency: "EUR" }).success).toBe(false);
  });

  it("rejects absurd durations", () => {
    expect(doctorServiceInputSchema.safeParse({ ...base, durationMinutes: 5 * 60 }).success).toBe(false);
  });
});

describe("serializers", () => {
  it("converts service decimals to numbers and keeps the rest", () => {
    // Prisma Decimals coerce through valueOf when Number() is applied.
    const decimal = (value: number) => ({ valueOf: () => value }) as never;
    expect(
      serializeDoctorService({
        id: "s1", kind: "NEW_PATIENT", name: "Consultation", description: null, modes: ["CHAT"],
        durationMinutes: 30, currency: "NGN", price: decimal(5000),
        followUpPrice: decimal(2000), followUpWindowDays: 14, isActive: true,
        icd10Codes: ["I10"], cancellationTerms: null, refundTerms: null, includes: [], addOns: [],
        createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ).toMatchObject({ id: "s1", price: 5000, followUpPrice: 2000 });
  });

  it("keeps the attachment pointer but not consent internals in public portfolio items", () => {
    const serialized = serializePublicPortfolioItem({
      id: "p1", type: "PUBLICATION", title: "A paper", description: "d",
      externalUrl: "https://example.com", publishedAt: new Date("2026-02-01T00:00:00Z"), attachmentFileId: "f1",
    });
    expect(serialized).toMatchObject({ id: "p1", attachmentFileId: "f1", publishedAt: "2026-02-01T00:00:00.000Z" });
    expect(serialized).not.toHaveProperty("consentStatus");
    expect(serialized).not.toHaveProperty("visibility");
  });
});
