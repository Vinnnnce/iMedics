import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/storage", () => ({
  copyObject: vi.fn(), deleteObject: vi.fn(), getObjectStream: vi.fn(), inspectObject: vi.fn(),
}));

import { isStagingSiteImageKey, isValidFinalSiteImageKey, publicSiteMediaUrl, siteImageUploadSchema } from "@/lib/site-media";
import { optionalImageRef } from "@/lib/content";

const ADMIN = "11111111-1111-4111-8111-111111111111";
const IMAGE = "22222222-2222-4222-8222-222222222222";

describe("site media keys", () => {
  it("accepts only well-formed final keys", () => {
    expect(isValidFinalSiteImageKey(`site-media/${ADMIN}/${IMAGE}`)).toBe(true);
    expect(isValidFinalSiteImageKey(`profile-images/${ADMIN}/${IMAGE}`)).toBe(false);
    expect(isValidFinalSiteImageKey(`site-media/${ADMIN}/../${IMAGE}`)).toBe(false);
    expect(isValidFinalSiteImageKey(`site-media/${ADMIN}/not-a-uuid`)).toBe(false);
  });
  it("only treats the owner's staging keys as uploadable", () => {
    expect(isStagingSiteImageKey(`site-media-uploads/${ADMIN}/${IMAGE}`, ADMIN)).toBe(true);
    expect(isStagingSiteImageKey(`site-media-uploads/${ADMIN}/${IMAGE}`, IMAGE)).toBe(false);
    expect(isStagingSiteImageKey(`site-media/${ADMIN}/${IMAGE}`, ADMIN)).toBe(false);
  });
  it("builds the public path the image reference validator accepts", () => {
    const url = publicSiteMediaUrl(`site-media/${ADMIN}/${IMAGE}`);
    expect(url).toBe(`/api/site-media/${ADMIN}/${IMAGE}`);
    expect(optionalImageRef.parse(url)).toBe(url);
  });
});

describe("image references and uploads", () => {
  it("accepts https URLs, rejects http and other local paths", () => {
    expect(optionalImageRef.parse("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(() => optionalImageRef.parse("http://example.com/a.png")).toThrow();
    expect(() => optionalImageRef.parse("/api/other/x")).toThrow();
    expect(optionalImageRef.parse("")).toBeNull();
  });
  it("limits uploads to 5 MB PNG/JPEG/WEBP", () => {
    const ok = { fileName: "a.png", mimeType: "image/png", sizeBytes: 1000 };
    expect(siteImageUploadSchema.safeParse(ok).success).toBe(true);
    expect(siteImageUploadSchema.safeParse({ ...ok, mimeType: "image/svg+xml" }).success).toBe(false);
    expect(siteImageUploadSchema.safeParse({ ...ok, sizeBytes: 6 * 1024 * 1024 }).success).toBe(false);
  });
});
