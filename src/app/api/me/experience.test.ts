import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  tour: { findUnique: vi.fn(), upsert: vi.fn() },
  receipts: { findMany: vi.fn() },
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.requireUser, requireRole: mocks.requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { productTour: mocks.tour, policyReceipt: mocks.receipts, $transaction: mocks.transaction } }));
import { GET as getTour, PATCH as saveTour } from "./tour/route";
import { GET as getPolicies, POST as acceptPolicies } from "./policies/route";
import { unauthorized } from "@/lib/errors";
import { POLICY_RELEASE } from "@/lib/legal/release";
const user = { id: "current-user", role: "PATIENT", accountType: "PATIENT", status: "ACTIVE", onboardingComplete: true, deletedAt: null };
const context = { params: Promise.resolve({}) };
function request(path: string, method = "GET", body?: unknown, origin = "https://care.example") {
  return new NextRequest(`https://care.example/api/me/${path}`, {
    method, headers: { origin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue(user);
  mocks.tour.findUnique.mockResolvedValue(null);
  mocks.tour.upsert.mockImplementation(async ({ update }) => update);
  mocks.receipts.findMany.mockResolvedValue([]);
});
describe("self-scoped onboarding and legal endpoints", () => {
  it("rejects unauthenticated requests", async () => {
    mocks.requireUser.mockRejectedValue(unauthorized("Authentication required"));
    expect((await getTour(request("tour"), context)).status).toBe(401);
    expect((await getPolicies(request("policies"), context)).status).toBe(401);
  });
  it("returns not started and queries only the authenticated account", async () => {
    const response = await getTour(request("tour?userId=another-user"), context);
    expect(await response.json()).toEqual({ status: "NOT_STARTED", step: 0 });
    expect(mocks.tour.findUnique).toHaveBeenCalledWith({ where: { userId_tourKey: { userId: user.id, tourKey: "workspace-v1:PATIENT:PATIENT:ACTIVE" } } });
  });
  it("ignores client-supplied identity and persists finish/skip/restart", async () => {
    for (const status of ["COMPLETED", "SKIPPED", "IN_PROGRESS"]) {
      expect((await saveTour(request("tour", "PATCH", { status, step: 0, userId: "victim" }), context)).status).toBe(200);
      expect(mocks.tour.upsert).toHaveBeenLastCalledWith(expect.objectContaining({ create: expect.objectContaining({ userId: user.id, status }) }));
    }
  });
  it("rejects cross-origin writes and invalid progress", async () => {
    expect((await saveTour(request("tour", "PATCH", { status: "COMPLETED", step: 0 }, "https://attacker.example"), context)).status).toBe(403);
    expect((await saveTour(request("tour", "PATCH", { status: "COMPLETED", step: -1 }), context)).status).toBe(400);
    expect(mocks.tour.upsert).not.toHaveBeenCalled();
  });
  it("keeps legal history self-scoped and never requests acceptance of a draft", async () => {
    const response = await getPolicies(request("policies?userId=victim"), context);
    expect(await response.json()).toMatchObject({ requiresConsent: false, current: { status: "DRAFT" } });
    expect(mocks.receipts.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: user.id } }));
  });
  it("refuses to turn draft acknowledgement into published acceptance", async () => {
    const response = await acceptPolicies(request("policies", "POST", { accepted: true, version: POLICY_RELEASE.version }), context);
    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
