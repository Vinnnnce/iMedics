/**
 * Always-running tests for facility document templates: staff with the
 * MANAGE_DOCUMENT_TEMPLATES permission can list and create their facility's
 * scaffolds, and only JSON objects of scaffold fields are accepted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    facilityDocumentTemplate: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    facilityStaff: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { PUT, DELETE } from "./[id]/route";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const FACILITY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const TEMPLATE_ID = "0f0e0d0c-0b0a-4009-8008-700600500400";
const USER = { id: USER_ID, role: "LAB_SCIENTIST", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;

const TEMPLATE = {
  id: TEMPLATE_ID,
  facilityId: FACILITY_ID,
  name: "Standard FBC report",
  kind: "LAB_REPORT",
  content: JSON.stringify({ findings: "Findings …" }),
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  createdBy: { name: "Lab Admin" },
};

const FACILITY = { id: FACILITY_ID, verificationStatus: "VERIFIED" };

const invokeGet = (kind?: string) =>
  GET(new NextRequest(`https://care.example/api/facility/document-templates${kind ? `?kind=${kind}` : ""}`), { user: USER } as never);

const invokePost = (body: unknown) =>
  POST(new NextRequest("https://care.example/api/facility/document-templates", {
    method: "POST",
    body: JSON.stringify(body),
  }), { user: USER } as never);

const invokePut = (body: unknown) =>
  PUT(new NextRequest(`https://care.example/api/facility/document-templates/${TEMPLATE_ID}`, {
    method: "PUT",
    body: JSON.stringify(body),
  }), { user: USER, params: Promise.resolve({ id: TEMPLATE_ID }) } as never);

const invokeDelete = () =>
  DELETE(new NextRequest(`https://care.example/api/facility/document-templates/${TEMPLATE_ID}`, { method: "DELETE" }),
    { user: USER, params: Promise.resolve({ id: TEMPLATE_ID }) } as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(USER);
  vi.mocked(prisma.facilityStaff.findMany).mockResolvedValue([
    {
      id: "staff-1", userId: USER_ID, facilityId: FACILITY_ID, facilityRole: "OWNER", status: "ACTIVE",
      facility: FACILITY,
    },
  ] as never);
  vi.mocked(prisma.facilityDocumentTemplate.findMany).mockResolvedValue([TEMPLATE] as never);
  vi.mocked(prisma.facilityDocumentTemplate.create).mockResolvedValue(TEMPLATE as never);
  vi.mocked(prisma.facilityDocumentTemplate.findUnique).mockResolvedValue(TEMPLATE as never);
  vi.mocked(prisma.facilityDocumentTemplate.update).mockResolvedValue(TEMPLATE as never);
  vi.mocked(prisma.facilityDocumentTemplate.delete).mockResolvedValue(TEMPLATE as never);
});

describe("facility document templates", () => {
  it("lists the facility's templates", async () => {
    const res = await invokeGet();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.templates).toHaveLength(1);
    expect(data.templates[0].name).toBe("Standard FBC report");
  });

  it("creates a valid scaffold", async () => {
    const res = await invokePost({
      name: "X-ray report",
      kind: "IMAGING_REPORT",
      content: JSON.stringify({ impression: "…" }),
    });
    expect(res.status).toBe(201);
    expect(prisma.facilityDocumentTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ facilityId: FACILITY_ID, createdById: USER_ID, kind: "IMAGING_REPORT" }),
      }),
    );
  });

  it("rejects content that is not a JSON object", async () => {
    const res = await invokePost({ name: "Bad", kind: "LAB_REPORT", content: "not json" });
    expect(res.status).toBe(400);
    const array = await invokePost({ name: "Bad", kind: "LAB_REPORT", content: JSON.stringify([1]) });
    expect(array.status).toBe(400);
    expect(prisma.facilityDocumentTemplate.create).not.toHaveBeenCalled();
  });

  it("refuses staff without the template permission", async () => {
    vi.mocked(prisma.facilityStaff.findMany).mockResolvedValue([
      {
        id: "staff-1", userId: USER_ID, facilityId: FACILITY_ID, facilityRole: "LAB_TECHNICIAN", status: "ACTIVE",
        facility: FACILITY,
      },
    ] as never);
    const res = await invokeGet();
    expect(res.status).toBe(403);
  });

  it("renames and deletes an owned template", async () => {
    const put = await invokePut({ name: "Renamed" });
    expect(put.status).toBe(200);
    expect(prisma.facilityDocumentTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TEMPLATE_ID }, data: { name: "Renamed" } }),
    );
    const del = await invokeDelete();
    expect(del.status).toBe(200);
    expect(prisma.facilityDocumentTemplate.delete).toHaveBeenCalledWith({ where: { id: TEMPLATE_ID } });
  });

  it("refuses a template belonging to another facility", async () => {
    vi.mocked(prisma.facilityDocumentTemplate.findUnique).mockResolvedValue({ ...TEMPLATE, facilityId: "other" } as never);
    const del = await invokeDelete();
    expect(del.status).toBe(403);
  });
});
