import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111", role: "PATIENT" },
  raw: vi.fn(), execute: vi.fn(), audit: vi.fn(), presign: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  withAuth: (roles: string[] | null, handler: (r: Request, c: unknown) => Promise<Response>) => async (req: Request) => {
    if (roles && !roles.includes(mocks.user.role)) return new Response("Forbidden", { status: 403 });
    return handler(req, { user: mocks.user });
  },
  parseBody: async (req: Request, schema: { parse: (x: unknown) => unknown }) => schema.parse(await req.json()),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.raw, $executeRaw: mocks.execute } }));
vi.mock("@/lib/workspace/extensions", () => ({ extensionAudit: mocks.audit }));
vi.mock("@/lib/storage", () => ({ presignDownload: mocks.presign, presignUpload: vi.fn() }));
vi.mock("@/lib/workspace/storage", () => ({ sealWorkspaceUpload: vi.fn() }));
vi.mock("@/lib/uploads", async () => {
  const { z } = await import("zod");
  return { safeFileName: (s: string) => s, verifyUpload: vi.fn(), uploadRequestSchema: z.object({ fileName: z.string(), mimeType: z.string(), sizeBytes: z.number() }) };
});
import { GET, POST } from "@/app/api/workspace/documents/route";
describe("document routes enforce role and document scope", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.role = "PATIENT"; });
  it.each(["ADMIN", "LAB_SCIENTIST"])("denies clinical document reads to %s", async role => {
    mocks.user.role = role;
    const response = await GET(new Request("http://local/api/workspace/documents") as never, {} as never);
    expect(response.status).toBe(403); expect(mocks.raw).not.toHaveBeenCalled();
  });
  it("requires owner or unexpired explicit consent and verified recipient in SQL", async () => {
    mocks.raw.mockResolvedValueOnce([]);
    await expect(GET(new Request("http://local/api/workspace/documents?id=22222222-2222-4222-8222-222222222222") as never, {} as never)).rejects.toThrow("Document not found");
    const sql = mocks.raw.mock.calls[0][0].join("?");
    expect(sql).toContain("owner_id"); expect(sql).toContain("revoked_at IS NULL");
    expect(sql).toContain("expires_at > now()"); expect(sql).toContain("verification_status = 'VERIFIED'");
    expect(mocks.presign).not.toHaveBeenCalled();
  });
  it("never presigns before the audit record is accepted", async () => {
    mocks.audit.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(GET(new Request("http://local/api/workspace/documents") as never, {} as never)).rejects.toThrow("audit unavailable");
    expect(mocks.raw).not.toHaveBeenCalled(); expect(mocks.presign).not.toHaveBeenCalled();
  });
  it("does not let doctors grant document access", async () => {
    mocks.user.role = "DOCTOR";
    expect((await POST(new Request("http://local/api/workspace/documents", { method: "POST" }) as never, {} as never)).status).toBe(403);
  });
  it("requires explicit consent before record sharing", async () => {
    const req = new Request("http://local/api/workspace/documents", { method: "POST", body: JSON.stringify({
      action: "share", id: "22222222-2222-4222-8222-222222222222", doctorId: "33333333-3333-4333-8333-333333333333", days: 7, consent: false,
    }) });
    await expect(POST(req as never, {} as never)).rejects.toThrow();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("scopes revocations to the signed-in owner", async () => {
    mocks.execute.mockResolvedValueOnce(0);
    await expect(POST(new Request("http://local/api/workspace/documents", { method: "POST", body: JSON.stringify({ action: "revoke", shareId: "22222222-2222-4222-8222-222222222222" }) }) as never, {} as never)).rejects.toThrow("Share not found");
    const sql = mocks.execute.mock.calls[0][0].join("?");
    expect(sql).toContain("owner_id ="); expect(mocks.execute.mock.calls[0]).toContain(mocks.user.id);
  });
});
