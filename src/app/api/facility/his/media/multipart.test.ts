import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/lib/his/access", () => ({
  requireHisAccess: vi.fn(), assertPatientLinked: vi.fn(),
  hasPermission: (a: { permissions: string[] }, p: string) => a.permissions.includes(p),
}));
vi.mock("@/lib/his/audit", () => ({ auditHis: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  presignUpload: vi.fn(), presignPartUpload: vi.fn(), createMultipartUpload: vi.fn(), listUploadedParts: vi.fn(),
  completeMultipartUpload: vi.fn(), abortMultipartUpload: vi.fn(), deleteObject: vi.fn(), presignDownload: vi.fn(), presignView: vi.fn(),
  UPLOAD_URL_TTL_SECONDS: 300, PART_URL_TTL_SECONDS: 3600, DOWNLOAD_URL_TTL_SECONDS: 60,
}));
vi.mock("@/lib/his/media-storage", () => ({ finalizeMedia: vi.fn(), stagingPrefix: (facilityId: string, patientId: string) => `medical-media/staging/${facilityId}/${patientId}/` }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    medicalMedia: { findFirst: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
    medicalMediaUploadSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    hospitalSettings: { findUnique: vi.fn() }, encounter: { findFirst: vi.fn() }, auditLog: { create: vi.fn() },
  },
}));

import { requireUser } from "@/lib/auth";
import { requireHisAccess } from "@/lib/his/access";
import { badRequest } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { abortMultipartUpload, completeMultipartUpload, createMultipartUpload, listUploadedParts, presignPartUpload, presignUpload } from "@/lib/storage";
import { finalizeMedia } from "@/lib/his/media-storage";
import { POST as presign } from "./route";
import { POST as partsRoute } from "./multipart/[id]/parts/route";
import { POST as completeRoute } from "./multipart/[id]/complete/route";
import { POST as abortRoute } from "./multipart/[id]/abort/route";

const SESSION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PATIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SHA = "a".repeat(64);
const MB = 1024 * 1024;

const request = (path: string, body?: unknown) => new NextRequest(`http://localhost:3000${path}`, {
  method: "POST", headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const ctx = { params: Promise.resolve({ id: SESSION_ID }) };
const session = {
  id: SESSION_ID, facilityId: "hospital-a", patientId: PATIENT, status: "ACTIVE", storageKey: "medical-media/staging/hospital-a/patient/x",
  s3UploadId: "s3-upload-id", partSizeBytes: BigInt(8 * MB), partsTotal: 3, declaredSizeBytes: BigInt(20 * MB), declaredSha256: SHA, formatKey: "dcm",
  expiresAt: new Date(Date.now() + 60_000),
};
const metadata = {
  patientId: PATIENT, fileName: "study.dcm", mimeType: "application/dicom", sha256: SHA, category: "CT",
  examinationType: "Synthetic CT study", sizeBytes: 20 * MB,
};
const uploadedParts = [
  { partNumber: 1, etag: "etag-1", sizeBytes: 8 * MB },
  { partNumber: 2, etag: "etag-2", sizeBytes: 8 * MB },
  { partNumber: 3, etag: "etag-3", sizeBytes: 4 * MB },
];

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("HIS_MULTIPART_THRESHOLD_BYTES", String(16 * MB));
  vi.mocked(requireUser).mockResolvedValue({ id: "staff", role: "LAB_SCIENTIST", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never);
  vi.mocked(requireHisAccess).mockResolvedValue({ facility: { id: "hospital-a" }, permissions: ["UPLOAD_MEDIA", "REVIEW_DOCUMENTS"] } as never);
  vi.mocked(prisma.medicalMedia.aggregate).mockResolvedValue({ _sum: { sizeBytes: BigInt(0) } } as never);
  vi.mocked(prisma.medicalMedia.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.medicalMediaUploadSession.findUnique).mockResolvedValue(session as never);
  vi.mocked(prisma.medicalMediaUploadSession.update).mockResolvedValue({ ...session, status: "COMPLETED" } as never);
  vi.mocked(prisma.medicalMediaUploadSession.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.hospitalSettings.findUnique).mockResolvedValue(null);
  vi.mocked(presignUpload).mockResolvedValue("https://storage/upload");
  vi.mocked(presignPartUpload).mockImplementation(async (key, uploadId, partNumber) => `https://storage/part-${partNumber}`);
  vi.mocked(createMultipartUpload).mockResolvedValue("s3-upload-id");
  vi.mocked(listUploadedParts).mockResolvedValue(uploadedParts as never);
  vi.mocked(completeMultipartUpload).mockResolvedValue(undefined);
  vi.mocked(finalizeMedia).mockResolvedValue({ finalKey: "final-key", sizeBytes: 20 * MB, sha256: SHA, scanStatus: "CLEAN" });
  vi.mocked(prisma.medicalMedia.create).mockResolvedValue({ id: "media-1" } as never);
});

describe("upload presign", () => {
  it("keeps small files on the single presigned-PUT path", async () => {
    const res = await presign(request("/api/facility/his/media", { ...metadata, sizeBytes: 10 * MB }), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("SINGLE");
    expect(data.uploadUrl).toBe("https://storage/upload");
  });
  it("opens a resumable multipart session with presigned parts for a large study", async () => {
    vi.mocked(prisma.medicalMediaUploadSession.create).mockResolvedValue({ id: SESSION_ID } as never);
    const res = await presign(request("/api/facility/his/media", { ...metadata, sizeBytes: 20 * MB }), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("MULTIPART");
    expect(data.session).toEqual({ id: SESSION_ID, partSizeBytes: 8 * MB, partsTotal: 3 });
    expect(data.parts).toHaveLength(3);
    expect(prisma.medicalMediaUploadSession.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ s3UploadId: "s3-upload-id", partsTotal: 3, status: "ACTIVE", declaredSha256: SHA }),
    }));
  });
  it("aborts the storage multipart upload if the session row cannot be created", async () => {
    vi.mocked(prisma.medicalMediaUploadSession.create).mockRejectedValue(new Error("Database unavailable"));
    const res = await presign(request("/api/facility/his/media", { ...metadata, sizeBytes: 20 * MB }), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(500);
    expect(abortMultipartUpload).toHaveBeenCalledWith(expect.any(String), "s3-upload-id");
  });
  it("refuses an upload that would exceed the facility storage quota", async () => {
    vi.mocked(prisma.medicalMedia.aggregate).mockResolvedValue({ _sum: { sizeBytes: BigInt(1024 * MB) } } as never);
    vi.stubEnv("HIS_MEDIA_QUOTA_BYTES", String(1024 * MB));
    const res = await presign(request("/api/facility/his/media", { ...metadata, sizeBytes: 20 * MB }), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(403);
  });
});

describe("multipart parts and resume", () => {
  it("presigns requested parts and reports what storage already holds", async () => {
    const res = await partsRoute(request(`/api/facility/his/media/multipart/${SESSION_ID}/parts`, { partNumbers: [2, 3] }), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.parts).toEqual([{ partNumber: 2, url: "https://storage/part-2" }, { partNumber: 3, url: "https://storage/part-3" }]);
    expect(data.uploaded).toHaveLength(3);
  });
  it("rejects part numbers beyond the session", async () => {
    const res = await partsRoute(request(`/api/facility/his/media/multipart/${SESSION_ID}/parts`, { partNumbers: [4] }), ctx);
    expect(res.status).toBe(400);
  });
});

describe("multipart completion", () => {
  it("completes from the storage service's parts, records the media and retires the session", async () => {
    const res = await completeRoute(request(`/api/facility/his/media/multipart/${SESSION_ID}/complete`, metadata), ctx);
    expect(res.status).toBe(201);
    expect(completeMultipartUpload).toHaveBeenCalledWith(session.storageKey, "s3-upload-id", [
      { partNumber: 1, etag: "etag-1" }, { partNumber: 2, etag: "etag-2" }, { partNumber: 3, etag: "etag-3" },
    ]);
    expect(finalizeMedia).toHaveBeenCalledWith(session.storageKey, "hospital-a", PATIENT, expect.objectContaining({ key: "dicom" }), SHA);
    expect(prisma.medicalMedia.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ storageKey: "final-key", sizeBytes: BigInt(20 * MB) }) }));
    expect(prisma.medicalMediaUploadSession.update).toHaveBeenCalledWith({ where: { id: SESSION_ID }, data: { status: "COMPLETED" } });
  });
  it("refuses a file that changed since the session started", async () => {
    const res = await completeRoute(request(`/api/facility/his/media/multipart/${SESSION_ID}/complete`, { ...metadata, sha256: "b".repeat(64) }), ctx);
    expect(res.status).toBe(400);
    expect(completeMultipartUpload).not.toHaveBeenCalled();
  });
  it("refuses an incomplete transfer with a resumable message", async () => {
    vi.mocked(listUploadedParts).mockResolvedValue(uploadedParts.slice(0, 2) as never);
    const res = await completeRoute(request(`/api/facility/his/media/multipart/${SESSION_ID}/complete`, metadata), ctx);
    expect(res.status).toBe(400);
    expect(completeMultipartUpload).not.toHaveBeenCalled();
  });
  it("abandons the session and aborts storage when final verification fails", async () => {
    vi.mocked(finalizeMedia).mockRejectedValue(badRequest("Checksum mismatch — the file was corrupted or changed during upload. Please retry."));
    const res = await completeRoute(request(`/api/facility/his/media/multipart/${SESSION_ID}/complete`, metadata), ctx);
    expect(res.status).toBe(400);
    expect(abortMultipartUpload).toHaveBeenCalled();
    expect(prisma.medicalMediaUploadSession.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "ABANDONED" } }));
  });
});

describe("multipart abort", () => {
  it("aborts storage and retires the session", async () => {
    const res = await abortRoute(request(`/api/facility/his/media/multipart/${SESSION_ID}/abort`), ctx);
    expect(res.status).toBe(200);
    expect(abortMultipartUpload).toHaveBeenCalledWith(session.storageKey, "s3-upload-id");
    expect(prisma.medicalMediaUploadSession.update).toHaveBeenCalledWith({ where: { id: SESSION_ID }, data: { status: "ABANDONED" } });
  });
});
