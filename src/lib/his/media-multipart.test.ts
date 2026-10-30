import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { badRequest, notFound } from "@/lib/errors";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    medicalMedia: { aggregate: vi.fn(), findFirst: vi.fn() },
    medicalMediaUploadSession: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  assertFacilityMediaQuota,
  facilityMediaQuotaBytes,
  multipartThresholdBytes,
  partSizeBytesFor,
  partsTotalFor,
  requireUploadSession,
  verifyUploadedParts,
} from "./media-multipart";

const access = { facility: { id: "hospital-a" }, permissions: ["UPLOAD_MEDIA"] } as never;
const MB = 1024 * 1024;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("HIS_MEDIA_QUOTA_BYTES", String(1024 * MB));
  vi.stubEnv("HIS_MULTIPART_THRESHOLD_BYTES", String(16 * MB));
});
afterEach(() => vi.unstubAllEnvs());

describe("multipart sizing", () => {
  it("uses 8 MB parts while the study stays under the 10,000-part limit", () => {
    expect(partSizeBytesFor(16 * MB)).toBe(8 * MB);
    expect(partSizeBytesFor(500 * MB)).toBe(8 * MB);
    expect(partSizeBytesFor(10_000 * 8 * MB)).toBe(8 * MB);
    expect(partsTotalFor(64 * MB, 8 * MB)).toBe(8);
    expect(partsTotalFor(8 * MB + 1, 8 * MB)).toBe(2);
  });
  it("grows part size only past 10,000 x 8 MB and keeps the part count bounded", () => {
    const huge = 4 * 1024 * 1024 * MB; // 4 TB
    const partSize = partSizeBytesFor(huge);
    expect(partSize).toBeGreaterThan(8 * MB);
    expect(Math.ceil(huge / partSize)).toBeLessThanOrEqual(9_000);
    expect(() => partSizeBytesFor(0)).toThrow(badRequest("Invalid file size") as never);
  });
  it("reads the threshold and quota from configuration with safe defaults", () => {
    expect(multipartThresholdBytes()).toBe(16 * MB);
    expect(facilityMediaQuotaBytes()).toBe(1024 * MB);
    vi.stubEnv("HIS_MULTIPART_THRESHOLD_BYTES", "1024");
    vi.stubEnv("HIS_MEDIA_QUOTA_BYTES", String(10 * MB));
    expect(multipartThresholdBytes()).toBe(64 * MB);
    expect(facilityMediaQuotaBytes()).toBe(20 * 1024 * MB);
  });
});

describe("facility storage quota", () => {
  it("admits an upload that fits the remaining quota", async () => {
    vi.mocked(prisma.medicalMedia.aggregate).mockResolvedValue({ _sum: { sizeBytes: BigInt(600 * MB) } } as never);
    await expect(assertFacilityMediaQuota("hospital-a", 400 * MB)).resolves.toBeUndefined();
  });
  it("refuses an upload that would exceed the quota", async () => {
    vi.mocked(prisma.medicalMedia.aggregate).mockResolvedValue({ _sum: { sizeBytes: BigInt(600 * MB) } } as never);
    await expect(assertFacilityMediaQuota("hospital-a", 500 * MB)).rejects.toThrow(/diagnostic-storage quota/);
  });
  it("treats an empty facility as zero bytes used", async () => {
    vi.mocked(prisma.medicalMedia.aggregate).mockResolvedValue({ _sum: { sizeBytes: null } } as never);
    await expect(assertFacilityMediaQuota("hospital-a", 1024 * MB)).resolves.toBeUndefined();
  });
});

describe("upload session requirements", () => {
  const session = {
    id: "session-1", facilityId: "hospital-a", patientId: "patient-1", status: "ACTIVE",
    expiresAt: new Date(Date.now() + 60_000), partsTotal: 3, partSizeBytes: BigInt(8 * MB), declaredSizeBytes: BigInt(20 * MB),
  };
  it("accepts an active, unexpired session of this facility", async () => {
    vi.mocked(prisma.medicalMediaUploadSession.findUnique).mockResolvedValue(session as never);
    await expect(requireUploadSession("session-1", access)).resolves.toBe(session);
  });
  it("hides other facilities' sessions as not found", async () => {
    vi.mocked(prisma.medicalMediaUploadSession.findUnique).mockResolvedValue({ ...session, facilityId: "hospital-b" } as never);
    await expect(requireUploadSession("session-1", access)).rejects.toThrow(notFound("Upload session not found") as never);
  });
  it("refuses completed or expired sessions", async () => {
    vi.mocked(prisma.medicalMediaUploadSession.findUnique).mockResolvedValue({ ...session, status: "COMPLETED" } as never);
    await expect(requireUploadSession("session-1", access)).rejects.toThrow(/no longer active/);
    vi.mocked(prisma.medicalMediaUploadSession.findUnique).mockResolvedValue({ ...session, expiresAt: new Date(Date.now() - 1) } as never);
    await expect(requireUploadSession("session-1", access)).rejects.toThrow(/expired/);
  });
});

describe("part verification from the storage service's own list", () => {
  const part = (partNumber: number, sizeBytes: number) => ({ partNumber, etag: `etag-${partNumber}`, sizeBytes });
  it("accepts a contiguous, complete transfer of the declared size", () => {
    const parts = verifyUploadedParts([part(1, 8 * MB), part(2, 8 * MB), part(3, 4 * MB)], 3, 8 * MB, 20 * MB);
    expect(parts).toEqual([{ partNumber: 1, etag: "etag-1" }, { partNumber: 2, etag: "etag-2" }, { partNumber: 3, etag: "etag-3" }]);
  });
  it("rejects missing parts, gaps, wrong totals and unexpected sizes", () => {
    expect(() => verifyUploadedParts([], 3, 8 * MB, 20 * MB)).toThrow(/No upload parts/);
    expect(() => verifyUploadedParts([part(1, 8 * MB), part(3, 4 * MB)], 3, 8 * MB, 20 * MB)).toThrow(/part 2 is missing/);
    expect(() => verifyUploadedParts([part(1, 8 * MB), part(2, 6 * MB), part(3, 4 * MB)], 3, 8 * MB, 20 * MB)).toThrow(/unexpected size/);
    expect(() => verifyUploadedParts([part(1, 8 * MB), part(2, 8 * MB), part(3, 6 * MB)], 3, 8 * MB, 20 * MB)).toThrow(/do not total/);
    expect(() => verifyUploadedParts([part(1, 8 * MB), part(2, 8 * MB), part(3, 9 * MB)], 3, 8 * MB, 20 * MB)).toThrow(/unexpected size/);
    expect(() => verifyUploadedParts([part(1, 8 * MB), part(2, 8 * MB)], 3, 8 * MB, 20 * MB)).toThrow(/2 of 3 parts/);
    expect(() => verifyUploadedParts([part(1, 8 * MB), part(1, 8 * MB), part(2, 8 * MB), part(3, 4 * MB)], 3, 8 * MB, 20 * MB)).toThrow(/duplicate/);
  });
});
