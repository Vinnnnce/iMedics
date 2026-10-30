import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/lib/his/access", () => ({
  requireHisAccess: vi.fn(), assertPatientLinked: vi.fn(),
  hasPermission: (a: { permissions: string[] }, p: string) => a.permissions.includes(p),
}));
vi.mock("@/lib/his/audit", () => ({ auditHis: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/storage", () => ({ deleteObject: vi.fn(), presignDownload: vi.fn(), presignView: vi.fn(), DOWNLOAD_URL_TTL_SECONDS: 60 }));
vi.mock("@/lib/his/media-storage", () => ({ finalizeMedia: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { medicalMedia: { findFirst: vi.fn(), updateMany: vi.fn(), create: vi.fn() }, hospitalSettings: { findUnique: vi.fn() }, patient: { findFirst: vi.fn() } },
}));

import { requireRole, requireUser } from "@/lib/auth";
import { requireHisAccess } from "@/lib/his/access";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/storage";
import { finalizeMedia } from "@/lib/his/media-storage";
import { GET, PATCH } from "./[id]/route";
import { POST } from "./confirm/route";
import { GET as PATIENT_GET } from "@/app/api/patient/media/[id]/route";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const at = new Date("2026-01-01T00:00:00Z");
const ctx = { params: Promise.resolve({ id: ID }) };
const request = (body?: unknown, method = "PATCH") => new NextRequest(`https://care.example/api/facility/his/media/${ID}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
const access = (permissions: string[]) => vi.mocked(requireHisAccess).mockResolvedValue({ facility: { id: "hospital-a" }, permissions } as never);
const file = (extra = {}) => ({
  id: ID, facilityId: "hospital-a", patientId: PATIENT, sensitivity: "STANDARD", deletedAt: null,
  releasedToPatientAt: null, reportStatus: "VERIFIED", scanStatus: "CLEAN", updatedAt: at, ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({ id: "staff", role: "LAB_SCIENTIST", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never);
  access(["VIEW_PATIENT_DOCUMENTS", "UPLOAD_MEDIA", "REVIEW_DOCUMENTS", "RELEASE_DOCUMENTS", "APPROVE_DOCUMENTS"]);
  vi.mocked(prisma.medicalMedia.findFirst).mockResolvedValue(file() as never);
  vi.mocked(prisma.medicalMedia.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.hospitalSettings.findUnique).mockResolvedValue(null);
});

describe("diagnostic media verification and release", () => {
  it("uses hospital-scoped optimistic updates for release", async () => {
    expect((await PATCH(request({ action: "release" }), ctx)).status).toBe(200);
    expect(prisma.medicalMedia.updateMany).toHaveBeenCalledWith({
      where: { id: ID, facilityId: "hospital-a", deletedAt: null, reportStatus: "VERIFIED", releasedToPatientAt: null, scanStatus: "CLEAN", sensitivity: "STANDARD" },
      data: { releasedToPatientAt: expect.any(Date) },
    });
  });
  it("rejects concurrent deletion/status change instead of releasing stale data", async () => {
    vi.mocked(prisma.medicalMedia.updateMany).mockResolvedValue({ count: 0 });
    expect((await PATCH(request({ action: "release" }), ctx)).status).toBe(409);
  });
  it("allows revoking an already-released record", async () => {
    vi.mocked(prisma.medicalMedia.findFirst).mockResolvedValue(file({ releasedToPatientAt: at }) as never);
    expect((await PATCH(request({ action: "revoke" }), ctx)).status).toBe(200);
    expect(prisma.medicalMedia.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { releasedToPatientAt: null } }));
  });
  it("clears patient release when a verified result becomes preliminary", async () => {
    expect((await PATCH(request({ action: "reportStatus", reportStatus: "PRELIMINARY" }), ctx)).status).toBe(200);
    expect(prisma.medicalMedia.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { reportStatus: "PRELIMINARY", releasedToPatientAt: null } }));
  });
  it("prevents non-reviewers from verifying reports or accessing protected media", async () => {
    access(["UPLOAD_MEDIA", "RELEASE_DOCUMENTS"]);
    expect((await PATCH(request({ action: "reportStatus", reportStatus: "VERIFIED" }), ctx)).status).toBe(403);
    vi.mocked(prisma.medicalMedia.findFirst).mockResolvedValue(file({ sensitivity: "SPECIALLY_PROTECTED" }) as never);
    expect((await PATCH(request({ action: "release", confirmProtected: true }), ctx)).status).toBe(403);
    expect(prisma.medicalMedia.updateMany).not.toHaveBeenCalled();
  });
  it("requires explicit protected release and verified reports", async () => {
    vi.mocked(prisma.medicalMedia.findFirst).mockResolvedValue(file({ sensitivity: "SPECIALLY_PROTECTED" }) as never);
    expect((await PATCH(request({ action: "release" }), ctx)).status).toBe(400);
    expect((await PATCH(request({ action: "release", confirmProtected: true }), ctx)).status).toBe(200);
    vi.mocked(prisma.medicalMedia.findFirst).mockResolvedValue(file({ reportStatus: "PRELIMINARY" }) as never);
    expect((await PATCH(request({ action: "release" }), ctx)).status).toBe(400);
  });
  it("cannot view or release infected media", async () => {
    vi.mocked(prisma.medicalMedia.findFirst).mockResolvedValue(file({ scanStatus: "INFECTED" }) as never);
    expect((await GET(request(undefined, "GET"), ctx)).status).toBe(403);
    expect((await PATCH(request({ action: "release" }), ctx)).status).toBe(403);
  });
  it("returns not found for another hospital's media", async () => {
    vi.mocked(prisma.medicalMedia.findFirst).mockResolvedValue(null);
    expect((await PATCH(request({ action: "release" }), ctx)).status).toBe(404);
    expect(prisma.medicalMedia.findFirst).toHaveBeenCalledWith({ where: { id: ID, facilityId: "hospital-a", deletedAt: null } });
  });
});

describe("upload confirmation", () => {
  const body = { key: "medical-media/staging/hospital-a/patient/file", patientId: PATIENT, fileName: "synthetic.pdf", mimeType: "application/pdf", sha256: "a".repeat(64), category: "LABORATORY_REPORT", examinationType: "Synthetic report" };
  it("cannot bypass verification permissions by submitting VERIFIED on upload", async () => {
    access(["UPLOAD_MEDIA"]);
    expect((await POST(request({ ...body, reportStatus: "VERIFIED" }, "POST"), { params: Promise.resolve({}) } as never)).status).toBe(403);
    expect(finalizeMedia).not.toHaveBeenCalled();
  });
  it("removes the final object if metadata persistence fails", async () => {
    vi.mocked(finalizeMedia).mockResolvedValue({ finalKey: "private-final-key", sizeBytes: 20, sha256: body.sha256, scanStatus: "CLEAN" });
    vi.mocked(prisma.medicalMedia.create).mockRejectedValue(new Error("Database unavailable"));
    expect((await POST(request(body, "POST"), { params: Promise.resolve({}) } as never)).status).toBe(500);
    expect(deleteObject).toHaveBeenCalledWith("private-final-key");
  });
});

describe("patient media downloads", () => {
  it("requires own-patient ownership, release, verification and noninfected status", async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: "patient-user", role: "PATIENT", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never);
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: PATIENT } as never);
    vi.mocked(prisma.medicalMedia.findFirst).mockResolvedValue(null);
    expect((await PATIENT_GET(request(undefined, "GET"), ctx)).status).toBe(404);
    expect(prisma.medicalMedia.findFirst).toHaveBeenCalledWith({
      where: { id: ID, patientId: PATIENT, deletedAt: null, releasedToPatientAt: { not: null }, reportStatus: { in: ["VERIFIED", "AMENDED"] }, scanStatus: { not: "INFECTED" } },
    });
  });
});
