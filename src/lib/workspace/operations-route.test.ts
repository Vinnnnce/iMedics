import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111", role: "PATIENT", status: "ACTIVE", onboardingComplete: true, deletedAt: null },
  auth: vi.fn(), raw: vi.fn(), execute: vi.fn(), audit: vi.fn(), transaction: vi.fn(),
  payment: vi.fn(), booking: vi.fn(), account: vi.fn(), refund: vi.fn(), notify: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth, requireRole: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $queryRaw: mocks.raw, $executeRaw: mocks.execute, $transaction: mocks.transaction,
  payment: { findFirst: mocks.payment }, user: { findFirst: mocks.account }, facilityBooking: { findFirst: mocks.booking },
} }));
vi.mock("@/lib/access", () => ({ getVerifiedFacilityProfile: async () => ({ id: "22222222-2222-4222-8222-222222222222" }) }));
vi.mock("@/lib/workspace/extensions", () => ({ extensionAudit: vi.fn() }));
vi.mock("@/lib/payments/service", () => ({ requestRefund: mocks.refund }));
vi.mock("@/lib/notifications/service", () => ({ queueNotification: mocks.notify }));
vi.mock("@/lib/facilities", () => ({ facilityBookingVisible: { status: { not: "CANCELLED" } } }));
import { POST } from "@/app/api/workspace/operations/route";
const id = "33333333-3333-4333-8333-333333333333";
const invoke = (body: object) => POST(new NextRequest("https://care.example/api/workspace/operations", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}), { params: Promise.resolve({}) });
describe("sensitive operational action boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.user.role = "PATIENT"; mocks.auth.mockResolvedValue(mocks.user);
    mocks.transaction.mockImplementation(callback => callback({ $queryRaw: mocks.raw, $executeRaw: mocks.execute, auditLog: { create: mocks.audit } }));
    mocks.raw.mockResolvedValue([]); mocks.execute.mockResolvedValue(1);
  });
  it("prevents patients from requesting administrative refunds", async () => {
    expect((await invoke({ action: "refund", paymentId: id, reason: "A valid review reason", confirm: true })).status).toBe(404);
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("prevents clinicians from resolving payment disputes", async () => {
    mocks.user.role = "DOCTOR";
    expect((await invoke({ action: "resolve", id, status: "RESOLVED", resolution: "Reviewed by admin" })).status).toBe(404);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("prevents facility staff from changing subscription entitlements", async () => {
    mocks.user.role = "LAB_SCIENTIST";
    expect((await invoke({ action: "subscription", ownerId: id, plan: "Practice", status: "ACTIVE" })).status).toBe(404);
  });
  it("does not allocate another facility's booking", async () => {
    mocks.user.role = "LAB_SCIENTIST"; mocks.booking.mockResolvedValue(null);
    expect((await invoke({ action: "assign", resourceId: id, bookingId: id, startsAt: "2026-10-17T10:00:00Z", endsAt: "2026-10-17T11:00:00Z" })).status).toBe(404);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("enforces resource capacity under a locked resource row", async () => {
    mocks.user.role = "LAB_SCIENTIST"; mocks.booking.mockResolvedValue({ id });
    mocks.raw.mockResolvedValueOnce([{ id, capacity: 1 }]).mockResolvedValueOnce([{ count: 1 }]);
    expect((await invoke({ action: "assign", resourceId: id, bookingId: id, startsAt: "2026-10-17T10:00:00Z", endsAt: "2026-10-17T11:00:00Z" })).status).toBe(400);
    expect(mocks.raw.mock.calls[0][0].join("?")).toContain("FOR UPDATE");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("does not remove allocations outside the caller's ownership", async () => {
    mocks.user.role = "LAB_SCIENTIST"; mocks.execute.mockResolvedValue(0);
    expect((await invoke({ action: "unassign", id })).status).toBe(404);
    expect(mocks.execute.mock.calls[0]).toContain(mocks.user.id);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("does not reopen or silently change a closed dispute", async () => {
    mocks.user.role = "ADMIN";
    expect((await invoke({ action: "resolve", id, status: "RESOLVED", resolution: "Reviewed" })).status).toBe(404);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("does not create duplicate open disputes", async () => {
    mocks.payment.mockResolvedValue({ id });
    mocks.raw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id }]);
    expect((await invoke({ action: "dispute", paymentId: id, reason: "A sufficiently detailed reason" })).status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
