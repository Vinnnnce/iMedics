import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Patient document access-control tests with a mocked Prisma client.
 * A patient must never see another patient's documents; clinicians only see
 * documents of assigned patients (or explicitly shared, read-only).
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    patientDocument: { findUnique: vi.fn() },
    documentShare: { findFirst: vi.fn() },
    doctorProfile: { findUnique: vi.fn() },
    patientAssignment: { findFirst: vi.fn() },
  },
}));

import { createDocumentSchema, looksLikeDeclaredType, findAccessibleDocument } from "./documents";
import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, { partial: true }) as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

function resetMocks() {
  for (const model of Object.values(mockPrisma)) for (const fn of Object.values(model)) fn.mockReset();
}

const document = {
  id: "doc-1",
  patientId: "patient-1",
  category: "LAB_RESULT",
  title: "Full blood count",
  fileName: "fbc.pdf",
  storageKey: "patient-documents/patient-1/x.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
  issuingFacility: null,
  issuedOn: null,
  notes: null,
  uploadedById: "uploader-1",
  createdAt: new Date(),
  deletedAt: null,
  patient: { userId: "user-1" },
};

const patientUser = { id: "user-1", role: "PATIENT" } as never;
const otherPatientUser = { id: "user-2", role: "PATIENT" } as never;
const doctorUser = { id: "doctor-user-1", role: "DOCTOR" } as never;

beforeEach(resetMocks);

describe("createDocumentSchema", () => {
  it("accepts a valid document payload", () => {
    const parsed = createDocumentSchema.parse({
      title: "Chest X-ray",
      category: "IMAGING_REPORT",
      fileName: "xray.png",
      mimeType: "image/png",
      sizeBytes: 2048,
    });
    expect(parsed.title).toBe("Chest X-ray");
  });

  it("rejects unexpected MIME types and oversized files", () => {
    expect(
      createDocumentSchema.safeParse({ title: "a", category: "IMAGING_REPORT", fileName: "a.exe", mimeType: "application/octet-stream", sizeBytes: 10 })
        .success,
    ).toBe(false);
    expect(
      createDocumentSchema.safeParse({ title: "a", category: "IMAGING_REPORT", fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 21 * 1024 * 1024 })
        .success,
    ).toBe(false);
  });
});

describe("looksLikeDeclaredType", () => {
  it("accepts real magic bytes", () => {
    expect(looksLikeDeclaredType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), "application/pdf")).toBe(true);
    expect(looksLikeDeclaredType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]), "image/png")).toBe(true);
    expect(looksLikeDeclaredType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
    expect(looksLikeDeclaredType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), "image/webp")).toBe(true);
  });

  it("rejects a file whose bytes do not match the declared type", () => {
    expect(looksLikeDeclaredType(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), "application/pdf")).toBe(false);
    expect(looksLikeDeclaredType(new Uint8Array([0x25, 0x50, 0x44, 0x46]), "image/png")).toBe(false);
  });
});

describe("findAccessibleDocument", () => {
  it("lets a patient see their own document with manage rights", async () => {
    mockPrisma.patientDocument.findUnique.mockResolvedValue(document);
    const result = await findAccessibleDocument(patientUser, "doc-1");
    expect(result.canManage).toBe(true);
  });

  it("hides another patient's document entirely (404, not 403)", async () => {
    mockPrisma.patientDocument.findUnique.mockResolvedValue(document);
    await expect(findAccessibleDocument(otherPatientUser, "doc-1")).rejects.toMatchObject({ status: 404 });
  });

  it("lets the doctor who uploaded a document manage it", async () => {
    mockPrisma.patientDocument.findUnique.mockResolvedValue({ ...document, uploadedById: "doctor-user-1" });
    mockPrisma.documentShare.findFirst.mockResolvedValue(null);
    const result = await findAccessibleDocument(doctorUser, "doc-1");
    expect(result.canManage).toBe(true);
  });

  it("gives an assigned doctor manage rights", async () => {
    mockPrisma.patientDocument.findUnique.mockResolvedValue(document);
    mockPrisma.documentShare.findFirst.mockResolvedValue(null);
    mockPrisma.doctorProfile.findUnique.mockResolvedValue({ id: "doctor-1" });
    mockPrisma.patientAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
    const result = await findAccessibleDocument(doctorUser, "doc-1");
    expect(result.canManage).toBe(true);
  });

  it("gives an explicitly shared doctor read-only access", async () => {
    mockPrisma.patientDocument.findUnique.mockResolvedValue(document);
    mockPrisma.documentShare.findFirst.mockResolvedValue({ id: "share-1" });
    mockPrisma.doctorProfile.findUnique.mockResolvedValue({ id: "doctor-1" });
    mockPrisma.patientAssignment.findFirst.mockResolvedValue(null);
    const result = await findAccessibleDocument(doctorUser, "doc-1");
    expect(result.canManage).toBe(false);
  });

  it("hides documents from unassigned doctors", async () => {
    mockPrisma.patientDocument.findUnique.mockResolvedValue(document);
    mockPrisma.documentShare.findFirst.mockResolvedValue(null);
    mockPrisma.doctorProfile.findUnique.mockResolvedValue({ id: "doctor-1" });
    mockPrisma.patientAssignment.findFirst.mockResolvedValue(null);
    await expect(findAccessibleDocument(doctorUser, "doc-1")).rejects.toMatchObject({ status: 404 });
  });

  it("never returns a deleted document", async () => {
    mockPrisma.patientDocument.findUnique.mockResolvedValue({ ...document, deletedAt: new Date() });
    await expect(findAccessibleDocument(patientUser, "doc-1")).rejects.toMatchObject({ status: 404 });
  });

  it("hides documents from admins (no patient-record access by policy)", async () => {
    mockPrisma.patientDocument.findUnique.mockResolvedValue(document);
    const adminUser = { id: "admin-user-1", role: "ADMIN" } as never;
    await expect(findAccessibleDocument(adminUser, "doc-1")).rejects.toMatchObject({ status: 404 });
  });

  it("hides a revoked share from a clinician", async () => {
    mockPrisma.patientDocument.findUnique.mockResolvedValue(document);
    mockPrisma.documentShare.findFirst.mockResolvedValue(null); // revoked → no live share
    mockPrisma.doctorProfile.findUnique.mockResolvedValue({ id: "doctor-1" });
    mockPrisma.patientAssignment.findFirst.mockResolvedValue(null);
    await expect(findAccessibleDocument(doctorUser, "doc-1")).rejects.toMatchObject({ status: 404 });
  });
});
