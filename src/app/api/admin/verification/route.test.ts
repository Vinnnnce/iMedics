import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111", role: "ADMIN", status: "ACTIVE", onboardingComplete: true, deletedAt: null },
  auth: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  notify: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth, requireRole: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: { doctorProfile: { findFirst: mocks.findFirst, update: mocks.update } },
}));
vi.mock("@/lib/notifications/service", () => ({ queueNotification: mocks.notify }));
vi.mock("@/lib/audit", () => ({ writeAudit: mocks.audit }));

import { PATCH } from "@/app/api/admin/verification/route";

const invoke = (body: object) =>
  PATCH(new NextRequest("https://care.example/api/admin/verification", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({}) });

describe("admin per-dimension verification", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue(mocks.user);
    mocks.findFirst.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222", userId: "33333333-3333-4333-8333-333333333333" });
    mocks.update.mockImplementation(({ data }) => Promise.resolve({ ...data }));
  });

  it("records a single dimension decision, notifies the doctor and audits", async () => {
    const response = await invoke({ userId: "33333333-3333-4333-8333-333333333333", identityVerification: "VERIFIED", notes: "checked passport" });
    expect(response.status).toBe(200);
    const updateData = mocks.update.mock.calls[0][0].data;
    expect(updateData.identityVerification).toBe("VERIFIED");
    expect(updateData.identityVerifiedAt).toBeInstanceOf(Date);
    // The untouched dimensions are not written.
    expect(updateData).not.toHaveProperty("licenseVerification");
    expect(mocks.notify).toHaveBeenCalledWith("33333333-3333-4333-8333-333333333333", { kind: "VERIFICATION_UPDATED" });
    expect(mocks.audit).toHaveBeenCalled();
  });

  it("clears the timestamp when a dimension is rejected", async () => {
    await invoke({ userId: "33333333-3333-4333-8333-333333333333", licenseVerification: "REJECTED" });
    const updateData = mocks.update.mock.calls[0][0].data;
    expect(updateData.licenseVerification).toBe("REJECTED");
    expect(updateData.licenseVerifiedAt).toBeNull();
  });

  it("reports unknown doctors as not found", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const response = await invoke({ userId: "33333333-3333-4333-8333-333333333333", identityVerification: "VERIFIED" });
    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects non-admin sessions", async () => {
    mocks.auth.mockRejectedValue(new ApiError(403, "forbidden"));
    const response = await invoke({ userId: "33333333-3333-4333-8333-333333333333", identityVerification: "VERIFIED" });
    expect([401, 403]).toContain(response.status);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid status", async () => {
    const response = await invoke({ userId: "33333333-3333-4333-8333-333333333333", identityVerification: "MAYBE" });
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
