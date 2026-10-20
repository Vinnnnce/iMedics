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

  it("uses the region from a regional AWS endpoint when the region is auto", () => {
    expect(getStorageRegion("auto", "https://s3.eu-north-1.amazonaws.com"))
      .toBe("eu-north-1");
    expect(getStorageRegion("auto", "https://bucket.s3.eu-north-1.amazonaws.com"))
      .toBe("eu-north-1");
    expect(getStorageRegion("auto", "https://s3.dualstack.eu-north-1.amazonaws.com"))
      .toBe("eu-north-1");
  });

  it("rejects auto for AWS endpoints that do not identify a region", () => {
    expect(() => getStorageRegion("auto", undefined))
      .toThrow("S3_REGION cannot be auto when using AWS S3");
    expect(() => getStorageRegion("auto", "https://s3.amazonaws.com"))
      .toThrow("S3_REGION cannot be auto when using AWS S3");
  });

  it("retains auto region support for custom S3-compatible endpoints", () => {
    expect(getStorageRegion("", "https://storage.example.com")).toBe("auto");
    expect(getStorageRegion("auto", "https://storage.example.com")).toBe("auto");
  });

  it("uses the regional AWS endpoint when the region is missing", () => {
    expect(getStorageRegion("", "https://s3.eu-north-1.amazonaws.com"))
      .toBe("eu-north-1");
  });
});
