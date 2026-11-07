import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), history: vi.fn(), receipt: vi.fn(), update: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser, requireRole: mocks.requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { policyReceipt: { findMany: mocks.history }, $transaction: mocks.transaction } }));
vi.mock("@/lib/legal/record", () => ({ recordPolicyReceipt: mocks.receipt }));
vi.mock("@/lib/legal/release", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/legal/release")>();
  return { ...actual, POLICY_RELEASE: { ...actual.POLICY_RELEASE, version: "synthetic-approved-v2", status: "PUBLISHED", effectiveDate: "2026-11-01" }, policyCanBeAccepted: () => true };
});
import { GET, POST } from "./route";
const context = { params: Promise.resolve({}) };
function request(body?: unknown) {
  return new NextRequest("https://care.example/api/me/policies", { method: body ? "POST" : "GET", headers: { origin: "https://care.example", "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "self", accountType: "DOCTOR", role: "DOCTOR", status: "ACTIVE", onboardingComplete: true });
  mocks.history.mockResolvedValue([]);
  mocks.transaction.mockImplementation(callback => callback({ user: { update: mocks.update } }));
});
describe("future approved-release re-consent (synthetic approval fixture only)", () => {
  it("requests review after a material version change", async () => {
    mocks.history.mockResolvedValue([{ version: "approved-v1", kind: "ACCEPTANCE" }]);
    expect(await (await GET(request(), context)).json()).toMatchObject({ requiresConsent: true });
  });
  it("does not repeatedly ask after acceptance", async () => {
    mocks.history.mockResolvedValue([{ version: "synthetic-approved-v2", kind: "ACCEPTANCE" }]);
    expect(await (await GET(request(), context)).json()).toMatchObject({ requiresConsent: false });
  });
  it("rejects stale documents without changing the account", async () => {
    expect((await POST(request({ version: "approved-v1", accepted: true }), context)).status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("records the signed-in user's explicit acceptance transactionally", async () => {
    expect((await POST(request({ version: "synthetic-approved-v2", accepted: true, userId: "victim" }), context)).status).toBe(200);
    expect(mocks.receipt).toHaveBeenCalledWith(expect.anything(), "self", "DOCTOR");
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "self" }, data: expect.objectContaining({ termsVersion: "synthetic-approved-v2", termsAcceptedAt: expect.any(Date) }) }));
  });
});
