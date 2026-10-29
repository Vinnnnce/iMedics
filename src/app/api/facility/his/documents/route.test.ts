/** Tenant isolation and workflow enforcement for HIS clinical documents (prisma mocked). */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(), requireUser: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notifyUser: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => {
  const m = () => ({ findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() });
  return { prisma: {
    facilityStaff: m(), labStaffProfile: m(), encounter: m(), admission: m(), facilityBooking: m(), labOrder: m(), payerCoverage: m(),
    clinicalDocument: m(), clinicalDocumentTemplate: m(), user: m(), documentSignature: m(), clinicalDocumentEvent: m(), hospitalSettings: m(),
    $transaction: vi.fn(),
  } };
});

import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";
import { PUT } from "./[id]/route";
import { POST as ACTION } from "./[id]/actions/route";

const USER = { id: "11111111-1111-4111-8111-111111111111", name: "Dr A", role: "LAB_SCIENTIST", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;
const FAC = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DOC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TPL = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const req = (url: string, init?: { method?: string; body?: unknown }) => new NextRequest(`https://care.example${url}`, { method: init?.method ?? "GET", ...(init?.body ? { body: JSON.stringify(init.body) } : {}) });
const asRole = (facilityRole: string) => vi.mocked(prisma.facilityStaff.findMany).mockResolvedValue([{ id: "s1", facilityRole, status: "ACTIVE", userId: USER, facility: { id: FAC, verificationStatus: "VERIFIED", kind: "HOSPITAL" } }] as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue(USER);
  asRole("OWNER");
  vi.mocked(prisma.labStaffProfile.findUnique).mockResolvedValue({ kind: "HOSPITAL", user: { accountType: "HOSPITAL" } } as never);
  for (const k of ["encounter", "admission", "facilityBooking", "labOrder", "payerCoverage", "clinicalDocument"] as const) vi.mocked(prisma[k].findFirst).mockResolvedValue(null as never);
});

describe("HIS documents API", () => {
  it("refuses patients without a care relationship with this facility (404, not leaked)", async () => {
    const res = await POST(req("/api/facility/his/documents", { method: "POST", body: { templateId: TPL, patientId: PATIENT } }), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(404);
    expect(prisma.clinicalDocument.create).not.toHaveBeenCalled();
  });

  it("scopes every query to the caller's facility", async () => {
    vi.mocked(prisma.clinicalDocument.findMany).mockResolvedValue([] as never);
    const res = await GET(req("/api/facility/his/documents"), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.clinicalDocument.findMany).mock.calls[0][0]?.where).toMatchObject({ facilityId: FAC });
  });

  it("returns 404 for another hospital's document id", async () => {
    vi.mocked(prisma.clinicalDocument.findFirst).mockResolvedValue(null as never);
    const res = await PUT(req(`/api/facility/his/documents/${DOC}`, { method: "PUT", body: { content: {} } }), { params: Promise.resolve({ id: DOC }) } as never);
    expect(res.status).toBe(404);
    expect(vi.mocked(prisma.clinicalDocument.findFirst).mock.calls[0][0]?.where).toMatchObject({ id: DOC, facilityId: FAC });
  });

  it("enforces role permissions in the backend", async () => {
    asRole("RECEPTIONIST");
    const res = await POST(req("/api/facility/his/documents", { method: "POST", body: { templateId: TPL, patientId: PATIENT } }), { params: Promise.resolve({}) } as never);
    expect(res.status).toBe(403);
  });

  it("never edits a finalized document", async () => {
    vi.mocked(prisma.clinicalDocument.findFirst).mockResolvedValue({ id: DOC, status: "FINAL", authorId: USER, patientId: PATIENT, templateVersion: { definition: { sections: [{ id: "a", title: "A", fields: [] }] } } } as never);
    const res = await PUT(req(`/api/facility/his/documents/${DOC}`, { method: "PUT", body: { content: {} } }), { params: Promise.resolve({ id: DOC }) } as never);
    expect(res.status).toBe(409);
  });

  it("refuses an attested patient signature without the witness attestation", async () => {
    vi.mocked(prisma.clinicalDocument.findFirst).mockResolvedValue({
      id: DOC, status: "PENDING_SIGNATURE", authorId: USER, patientId: PATIENT, content: {}, signatures: [], updatedAt: new Date(),
      templateVersion: { version: 1, definition: { sections: [{ id: "a", title: "A", fields: [] }], signatures: [{ role: "PATIENT", label: "Patient", required: true }] } },
      patient: { userId: null },
    } as never);
    const res = await ACTION(req(`/api/facility/his/documents/${DOC}/actions`, { method: "POST", body: { action: "sign", role: "PATIENT", signerName: "Jane Doe" } }), { params: Promise.resolve({ id: DOC }) } as never);
    expect(res.status).toBe(400);
    expect(prisma.documentSignature.create).not.toHaveBeenCalled();
  });
});
