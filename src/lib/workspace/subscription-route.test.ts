import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111", role: "DOCTOR", status: "ACTIVE", onboardingComplete: true, deletedAt: null },
  auth: vi.fn(), execute: vi.fn(), audit: vi.fn(), transaction: vi.fn(), doctor: vi.fn(), facility: vi.fn(), notify: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth, requireRole: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/access", () => ({ getVerifiedDoctorProfile: mocks.doctor, getVerifiedFacilityProfile: mocks.facility }));
vi.mock("@/lib/notifications/service", () => ({ queueNotification: mocks.notify }));
import { PATCH } from "@/app/api/workspace/subscription/route";
const invoke = (body: object) => PATCH(new NextRequest("https://care.example/api/workspace/subscription", {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}), { params: Promise.resolve({}) });
describe("owned subscription entitlement updates", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.user.role = "DOCTOR"; mocks.auth.mockResolvedValue(mocks.user);
    mocks.execute.mockResolvedValue(1);
    mocks.transaction.mockImplementation(callback => callback({ $executeRaw: mocks.execute, auditLog: { create: mocks.audit } }));
  });
  it("requires explicit confirmation", async () => {
    expect((await invoke({ status: "PAUSED" })).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("does not allow self-service activation", async () => {
    expect((await invoke({ status: "ACTIVE", confirm: true })).status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("scopes writes to the verified doctor's active entitlement and audits", async () => {
    const response = await invoke({ status: "PAUSED", confirm: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "PAUSED", billingCancelled: false });
    expect(mocks.doctor).toHaveBeenCalledWith(mocks.user);
    expect(mocks.execute.mock.calls[0]).toContain(mocks.user.id);
    expect(mocks.execute.mock.calls[0][0].join("?")).toContain("status = 'ACTIVE'");
    expect(mocks.audit).toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith(mocks.user.id, { kind: "SUBSCRIPTION_UPDATED" });
  });
  it("checks facility verification for facility self-service", async () => {
    mocks.user.role = "LAB_SCIENTIST";
    expect((await invoke({ status: "CANCELLED", confirm: true })).status).toBe(200);
    expect(mocks.facility).toHaveBeenCalledWith(mocks.user);
    expect(mocks.doctor).not.toHaveBeenCalled();
  });
  it("does not notify or audit when no owned active entitlement exists", async () => {
    mocks.execute.mockResolvedValue(0);
    expect((await invoke({ status: "CANCELLED", confirm: true })).status).toBe(404);
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
