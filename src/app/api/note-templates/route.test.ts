/**
 * Always-running tests for saved documentation templates: doctors can list
 * and create their own scaffolds, and only JSON objects of scaffold fields
 * are accepted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { noteTemplate: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PUT, DELETE } from "./[id]/route";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const TEMPLATE_ID = "0f0e0d0c-0b0a-4009-8008-700600500400";
const USER = { id: USER_ID, role: "DOCTOR", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;

const TEMPLATE = {
  id: TEMPLATE_ID,
  authorId: USER_ID,
  name: "Paediatric follow-up",
  kind: "CONSULTATION",
  content: JSON.stringify({ history: "Interval history:\n", examination: "", notes: "" }),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const invokeGet = (kind?: string) =>
  GET(new NextRequest(`https://care.example/api/note-templates${kind ? `?kind=${kind}` : ""}`), { user: USER } as never);

const invokePost = (body: unknown) =>
  POST(new NextRequest("https://care.example/api/note-templates", {
    method: "POST",
    body: JSON.stringify(body),
  }), { user: USER } as never);

const invokePut = (body: unknown) =>
  PUT(new NextRequest(`https://care.example/api/note-templates/${TEMPLATE_ID}`, {
    method: "PUT",
    body: JSON.stringify(body),
  }), { user: USER, params: Promise.resolve({ id: TEMPLATE_ID }) } as never);

const invokeDelete = () =>
  DELETE(new NextRequest(`https://care.example/api/note-templates/${TEMPLATE_ID}`, { method: "DELETE" }),
    { user: USER, params: Promise.resolve({ id: TEMPLATE_ID }) } as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(USER);
  vi.mocked(prisma.noteTemplate.findMany).mockResolvedValue([TEMPLATE] as never);
  vi.mocked(prisma.noteTemplate.create).mockResolvedValue(TEMPLATE as never);
  vi.mocked(prisma.noteTemplate.findUnique).mockResolvedValue(TEMPLATE as never);
  vi.mocked(prisma.noteTemplate.update).mockResolvedValue(TEMPLATE as never);
  vi.mocked(prisma.noteTemplate.delete).mockResolvedValue(TEMPLATE as never);
});

describe("GET /api/note-templates", () => {
  it("lists the clinician's saved templates", async () => {
    const res = await invokeGet();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.templates).toHaveLength(1);
    expect(data.templates[0].name).toBe("Paediatric follow-up");
  });

  it("filters by kind when requested", async () => {
    await invokeGet("CONSULTATION");
    expect(prisma.noteTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authorId: USER_ID, kind: "CONSULTATION" } }),
    );
  });
});

describe("POST /api/note-templates", () => {
  it("saves a valid consultation scaffold", async () => {
    const res = await invokePost({
      name: "Ward round",
      kind: "CONSULTATION",
      content: JSON.stringify({ history: "…", examination: "…", notes: "…" }),
    });
    expect(res.status).toBe(201);
    expect(prisma.noteTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorId: USER_ID, name: "Ward round", kind: "CONSULTATION" }) }),
    );
  });

  it("rejects content that is not a JSON object", async () => {
    const res = await invokePost({ name: "Bad", kind: "CONSULTATION", content: "not json" });
    expect(res.status).toBe(400);
    const array = await invokePost({ name: "Bad", kind: "CONSULTATION", content: JSON.stringify(["a"]) });
    expect(array.status).toBe(400);
    expect(prisma.noteTemplate.create).not.toHaveBeenCalled();
  });

  it("rejects an empty name", async () => {
    const res = await invokePost({ name: "   ", kind: "CONSULTATION", content: "{}" });
    expect(res.status).not.toBe(201);
  });
});

describe("PUT/DELETE /api/note-templates/[id]", () => {
  it("renames an owned template", async () => {
    const res = await invokePut({ name: "Renamed" });
    expect(res.status).toBe(200);
    expect(prisma.noteTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TEMPLATE_ID }, data: { name: "Renamed" } }),
    );
  });

  it("refuses to edit another author's template", async () => {
    vi.mocked(prisma.noteTemplate.findUnique).mockResolvedValue({ ...TEMPLATE, authorId: "someone-else" } as never);
    const res = await invokePut({ name: "Renamed" });
    expect(res.status).toBe(403);
    const del = await invokeDelete();
    expect(del.status).toBe(403);
  });

  it("deletes an owned template", async () => {
    const res = await invokeDelete();
    expect(res.status).toBe(200);
    expect(prisma.noteTemplate.delete).toHaveBeenCalledWith({ where: { id: TEMPLATE_ID } });
  });

  it("returns 404 for a missing template", async () => {
    vi.mocked(prisma.noteTemplate.findUnique).mockResolvedValue(null as never);
    const res = await invokeDelete();
    expect(res.status).toBe(404);
  });
});
