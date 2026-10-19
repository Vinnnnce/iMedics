import { describe, expect, it } from "vitest";
import { getStorageEndpoint, getStorageRegion } from "./storage-config";

describe("getStorageEndpoint", () => {
  it("allows the default AWS endpoint when no custom endpoint is configured", () => {
    expect(getStorageEndpoint("")).toBeUndefined();
  });

  it("accepts an absolute HTTP or HTTPS S3 endpoint", () => {
    expect(getStorageEndpoint("https://abc123.r2.cloudflarestorage.com"))
      .toBe("https://abc123.r2.cloudflarestorage.com");
  });

  it("rejects an unresolved provider placeholder", () => {
    expect(() => getStorageEndpoint("https://<account-id>.r2.cloudflarestorage.com"))
      .toThrow("S3_ENDPOINT to a valid S3 service URL without placeholder text");
  });

  it("rejects unsupported protocols", () => {
    expect(() => getStorageEndpoint("ftp://storage.example.com"))
      .toThrow("S3_ENDPOINT to a valid S3 service URL without placeholder text");
  });

  it("uses the configured AWS bucket region", () => {
    expect(getStorageRegion("eu-west-2", undefined)).toBe("eu-west-2");
  });

  it("rejects a missing AWS region instead of signing with an incompatible default", () => {
    expect(() => getStorageRegion("", undefined))
      .toThrow("Set S3_REGION to the AWS region containing S3_BUCKET");
  });

  it("rejects the Cloudflare-style auto region when no custom endpoint is set", () => {
    expect(() => getStorageRegion("auto", undefined))
      .toThrow("S3_REGION cannot be auto when using AWS S3");
  });

  it("retains auto region support for custom S3-compatible endpoints", () => {
    expect(getStorageRegion("", "https://storage.example.com")).toBe("auto");
  });
});
