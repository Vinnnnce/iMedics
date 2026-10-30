import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(async () => ({ userId: "synthetic-clerk" })), currentUser: vi.fn() }));
vi.mock("./prisma", () => ({ prisma: {
  user: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
  patient: { findUnique: vi.fn(async () => null) },
} }));
import { prisma } from "./prisma";
import { getCurrentUser, requireUser } from "./auth";

beforeEach(() => vi.clearAllMocks());
describe("synthetic account expiry", () => {
  it("rejects an expired account even when its Clerk session is valid", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "expired", testAccountExpiresAt: new Date(0) } as never);
    expect(await getCurrentUser()).toBeNull();
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it("keeps a non-expiring account unchanged", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "normal", testAccountExpiresAt: null } as never);
    expect(await getCurrentUser()).toMatchObject({ id: "normal" });
  });
  it("accepts a disposable account only before its expiry", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "synthetic", testAccountExpiresAt: new Date(Date.now() + 60000) } as never);
    expect(await getCurrentUser()).toMatchObject({ id: "synthetic" });
  });
});
