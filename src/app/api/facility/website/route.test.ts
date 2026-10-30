/** Real route/authorization code, mocked Prisma. Not a live database test. */
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  facilityStaff: { count: vi.fn(), findMany: vi.fn() },
  labStaffProfile: { findUnique: vi.fn() },
  facilityWebsite: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  facilityWebsiteRevision: { create: vi.fn() },
  $transaction: vi.fn(),
} }));
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/errors";
import { GET, PUT, POST, DELETE } from "./route";
import { newWebsiteBlock } from "@/lib/website/blocks";

const facility = { id: "f1", slug: "sample-clinic", kind: "HOSPITAL", verificationStatus: "VERIFIED", isPublished: true };
const user = { id: "u1", role: "PATIENT", status: "ACTIVE", onboardingComplete: true, deletedAt: null };
const ctx = { params: Promise.resolve({}) };
const req = (method = "GET", body?: unknown, id = "f1") => new NextRequest(`https://care.example/api/facility/website?facilityId=${id}`, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const row = () => ({ id: "w1", facilityId: "f1", template: "clinic-lite", draftLayout: { version: 1, blocks: [] }, publishedLayout: null, addOns: [], draftSavedAt: null, publishedAt: null });
const membership = (role = "FACILITY_MANAGER", status = "ACTIVE", fac = facility) => vi.mocked(prisma.facilityStaff.findMany).mockResolvedValue([{ id: "s1", facilityRole: role, status, facility: fac }] as never);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUser).mockResolvedValue(user as never);
  vi.mocked(prisma.facilityStaff.count).mockResolvedValue(1);
  membership();
  vi.mocked(prisma.facilityWebsite.findUnique).mockResolvedValue(row() as never);
  vi.mocked(prisma.facilityWebsite.upsert).mockResolvedValue(row() as never);
  vi.mocked(prisma.facilityWebsite.update).mockResolvedValue({ ...row(), publishedAt: new Date() } as never);
  vi.mocked(prisma.$transaction).mockImplementation(async (actions) => Promise.all(actions as never));
});

describe("facility website permissions and workflows", () => {
  it("allows invited PATIENT-role managers and scopes queries to their facility", async () => {
    const response = await GET(req(), ctx);
    expect(response.status).toBe(200);
    expect(prisma.facilityWebsite.findUnique).toHaveBeenCalledWith({ where: { facilityId: "f1" } });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("returns 401 without authentication", async () => {
    vi.mocked(requireUser).mockRejectedValue(unauthorized());
    expect((await GET(req(), ctx)).status).toBe(401);
  });
  it.each(["RECEPTIONIST", "NURSE", "LAB_TECHNICIAN"])("rejects %s without MANAGE_PROFILE", async (role) => {
    membership(role);
    expect((await PUT(req("PUT", { layout: { version: 1, blocks: [] }, addOns: [] }), ctx)).status).toBe(403);
    expect(prisma.facilityWebsite.upsert).not.toHaveBeenCalled();
  });
  it("rejects inactive users", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ...user, status: "SUSPENDED" } as never);
    expect((await GET(req(), ctx)).status).toBe(403);
  });
  it("rejects on-leave memberships", async () => {
    membership("OWNER", "ON_LEAVE");
    expect((await POST(req("POST", {}), ctx)).status).toBe(403);
  });
  it.each(["GET", "PUT", "POST", "DELETE"])("rejects cross-facility %s before accessing website rows", async (method) => {
    const handler = { GET, PUT, POST, DELETE }[method as "GET"];
    expect((await handler(req(method, method === "PUT" ? { layout: { version: 1, blocks: [] } } : undefined, "f2"), ctx)).status).toBe(403);
    expect(prisma.facilityWebsite.findUnique).not.toHaveBeenCalled();
    expect(prisma.facilityWebsite.upsert).not.toHaveBeenCalled();
  });
  it("requires explicit selection for multiple facilities", async () => {
    vi.mocked(prisma.facilityStaff.findMany).mockResolvedValue([
      { id: "s1", facilityRole: "OWNER", status: "ACTIVE", facility },
      { id: "s2", facilityRole: "OWNER", status: "ACTIVE", facility: { ...facility, id: "f2" } },
    ] as never);
    expect((await GET(new NextRequest("https://care.example/api/facility/website"), ctx)).status).toBe(400);
  });
  it("supports legacy owners only for their own facility", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ...user, role: "LAB_SCIENTIST" } as never);
    vi.mocked(prisma.facilityStaff.count).mockResolvedValue(0);
    vi.mocked(prisma.labStaffProfile.findUnique).mockResolvedValue(facility as never);
    expect((await GET(req(), ctx)).status).toBe(200);
    expect((await GET(req("GET", undefined, "f2"), ctx)).status).toBe(403);
  });
  it("does not let legacy ownership bypass an inactive membership", async () => {
    vi.mocked(requireUser).mockResolvedValue({ ...user, role: "LAB_SCIENTIST" } as never);
    vi.mocked(prisma.facilityStaff.findMany).mockResolvedValue([]);
    expect((await GET(req(), ctx)).status).toBe(403);
    expect(prisma.facilityWebsite.findUnique).not.toHaveBeenCalled();
  });
  it("initializes a missing draft with race-safe upsert", async () => {
    vi.mocked(prisma.facilityWebsite.findUnique).mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(200);
    expect(prisma.facilityWebsite.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { facilityId: "f1" }, update: {} }));
  });
  it("saves and reloads a draft without publishing (mocked persistence)", async () => {
    let stored = row();
    vi.mocked(prisma.facilityWebsite.upsert).mockImplementation((async (args: Parameters<typeof prisma.facilityWebsite.upsert>[0]) => {
      stored = { ...stored, ...args.update } as typeof stored;
      return stored as never;
    }) as never);
    vi.mocked(prisma.facilityWebsite.findUnique).mockImplementation((async () => stored) as never);
    const layout = { version: 1, blocks: [newWebsiteBlock("about", { title: "Saved clinic", body: "Test description" })] };
    expect((await PUT(req("PUT", { template: "clinic-lite", layout, addOns: [] }), ctx)).status).toBe(200);
    const reloaded = await (await GET(req(), ctx)).json();
    expect(reloaded.website.draftLayout.blocks[0].settings.title).toBe("Saved clinic");
    expect(reloaded.website.publishedLayout).toBeNull();
  });
  it("returns 400 for malformed settings, missing add-ons and unknown add-ons", async () => {
    for (const body of [
      { layout: { version: 1, blocks: [newWebsiteBlock("banner", { heading: "x".repeat(501) })] }, addOns: [] },
      { layout: { version: 1, blocks: [newWebsiteBlock("cta")] }, addOns: [] },
      { layout: { version: 1, blocks: [] }, addOns: ["unknown"] },
    ]) expect((await PUT(req("PUT", body), ctx)).status).toBe(400);
  });
  it("returns 400 for duplicate blocks and malformed JSON", async () => {
    const block = newWebsiteBlock("about");
    expect((await PUT(req("PUT", { layout: { version: 1, blocks: [block, block] } }), ctx)).status).toBe(400);
    expect((await PUT(new NextRequest("https://care.example/api/facility/website?facilityId=f1", { method: "PUT", body: "{" }), ctx)).status).toBe(400);
  });
  it("publishes the saved draft and revision together", async () => {
    expect((await POST(req("POST", {}), ctx)).status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.facilityWebsiteRevision.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ websiteId: "w1", publishedById: "u1" }) }));
  });
  it("refuses publication until the facility is public and verified", async () => {
    membership("OWNER", "ACTIVE", { ...facility, isPublished: false });
    expect((await POST(req("POST", {}), ctx)).status).toBe(400);
    expect(prisma.facilityWebsite.update).not.toHaveBeenCalled();
  });
  it("unpublishes only the caller's website", async () => {
    expect((await DELETE(req("DELETE"), ctx)).status).toBe(200);
    expect(prisma.facilityWebsite.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "w1" }, data: expect.objectContaining({ publishedAt: null }) }));
  });
});
