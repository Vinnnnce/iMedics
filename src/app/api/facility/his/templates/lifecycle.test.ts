import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/lib/his/access", () => ({ requireHisAccess: vi.fn(), hasPermission: (a: { permissions: string[] }, p: string) => a.permissions.includes(p) }));
vi.mock("@/lib/his/audit", () => ({ auditHis: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const model = () => ({ findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() });
  return { prisma: { clinicalDocumentTemplate: model(), clinicalDocumentTemplateVersion: model(), hospitalSettings: model(), $transaction: vi.fn() } };
});

import { requireUser } from "@/lib/auth";
import { requireHisAccess } from "@/lib/his/access";
import { prisma } from "@/lib/prisma";
import { parseDefinition } from "@/lib/his/template-schema";
import { POST } from "./[id]/actions/route";
import { PUT } from "./[id]/route";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const def = parseDefinition({ sections: [{ id: "s", title: "S", fields: [{ id: "f", label: "Mandatory", type: "text", locked: true, required: true }] }] });
const at = new Date("2026-01-01T00:00:00Z");
const request = (body: unknown, method = "POST") => new NextRequest(`https://care.example/api/facility/his/templates/${ID}/actions`, { method, body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({ id: ID }) };
const template = (status = "DRAFT", editor = USER) => ({
  id: ID, facilityId: "facility-a", updatedAt: at, sourceCode: null, retiredAt: null,
  versions: [{ id: "version", version: 2, status, updatedAt: at, definition: def, editedById: editor }],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({ id: USER, role: "LAB_SCIENTIST", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never);
  vi.mocked(requireHisAccess).mockResolvedValue({ facility: { id: "facility-a" }, permissions: ["MANAGE_DOCUMENT_TEMPLATES", "APPROVE_DOCUMENTS"] } as never);
  vi.mocked(prisma.clinicalDocumentTemplate.findFirst).mockResolvedValue(template() as never);
  vi.mocked(prisma.clinicalDocumentTemplate.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.clinicalDocumentTemplateVersion.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.hospitalSettings.findUnique).mockResolvedValue({ independentTemplateApproval: true } as never);
  vi.mocked(prisma.$transaction).mockImplementation(async (fn) => (fn as unknown as (tx: typeof prisma) => Promise<unknown>)(prisma));
});

describe("hospital template isolation and lifecycle", () => {
  it("does not load or change another hospital's template", async () => {
    vi.mocked(prisma.clinicalDocumentTemplate.findFirst).mockResolvedValue(null);
    expect((await POST(request({ action: "submit" }), ctx)).status).toBe(404);
    expect(prisma.clinicalDocumentTemplate.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID, facilityId: "facility-a" } }));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("submits a draft within guarded parent/version writes", async () => {
    expect((await POST(request({ action: "submit" }), ctx)).status).toBe(200);
    expect(prisma.clinicalDocumentTemplate.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID, facilityId: "facility-a", updatedAt: at } }));
    expect(prisma.clinicalDocumentTemplateVersion.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "version", status: "DRAFT", updatedAt: at } }));
    expect(prisma.clinicalDocumentTemplateVersion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "IN_REVIEW" }) }));
  });
  it("rejects publication when a concurrent save/action won the parent lock", async () => {
    vi.mocked(prisma.clinicalDocumentTemplate.findFirst).mockResolvedValue(template("APPROVED") as never);
    vi.mocked(prisma.clinicalDocumentTemplate.updateMany).mockResolvedValue({ count: 0 });
    expect((await POST(request({ action: "publish" }), ctx)).status).toBe(409);
    expect(prisma.clinicalDocumentTemplateVersion.update).not.toHaveBeenCalled();
  });
  it("requires independent approval before publication", async () => {
    vi.mocked(prisma.clinicalDocumentTemplate.findFirst).mockResolvedValue(template("IN_REVIEW") as never);
    expect((await POST(request({ action: "approve" }), ctx)).status).toBe(403);
    vi.mocked(prisma.clinicalDocumentTemplate.findFirst).mockResolvedValue(template("IN_REVIEW", "another-editor") as never);
    expect((await POST(request({ action: "approve" }), ctx)).status).toBe(200);
    expect(prisma.clinicalDocumentTemplateVersion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED", approvedById: USER }) }));
  });
  it("publishes only this template's approved version and retires its previous published version", async () => {
    vi.mocked(prisma.clinicalDocumentTemplate.findFirst).mockResolvedValue(template("APPROVED") as never);
    expect((await POST(request({ action: "publish" }), ctx)).status).toBe(200);
    expect(prisma.clinicalDocumentTemplateVersion.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { templateId: ID, status: "PUBLISHED" }, data: expect.objectContaining({ status: "RETIRED" }) }));
    expect(prisma.clinicalDocumentTemplate.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID }, data: { publishedVersion: 2, retiredAt: null } }));
  });
  it("preserves published definitions and clones a new draft", async () => {
    vi.mocked(prisma.clinicalDocumentTemplate.findFirst).mockResolvedValue(template("PUBLISHED") as never);
    expect((await POST(request({ action: "new-version" }), ctx)).status).toBe(200);
    expect(prisma.clinicalDocumentTemplateVersion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ templateId: ID, version: 3, status: "DRAFT", definition: def }) });
    expect(prisma.clinicalDocumentTemplateVersion.update).not.toHaveBeenCalled();
  });
  it("does not edit a published version", async () => {
    vi.mocked(prisma.clinicalDocumentTemplate.findFirst).mockResolvedValue(template("PUBLISHED") as never);
    expect((await PUT(request({ definition: def }, "PUT"), ctx)).status).toBe(409);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("rejects a draft save when the version was concurrently submitted", async () => {
    vi.mocked(prisma.clinicalDocumentTemplateVersion.updateMany).mockResolvedValue({ count: 0 });
    expect((await PUT(request({ definition: def }, "PUT"), ctx)).status).toBe(409);
  });
  it("preserves hospital-defined locks as well as catalogue locks", async () => {
    const withoutRequired = { ...def, sections: [{ ...def.sections[0], fields: [{ ...def.sections[0].fields[0], required: false, locked: false }] }] };
    expect((await PUT(request({ definition: withoutRequired }, "PUT"), ctx)).status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
