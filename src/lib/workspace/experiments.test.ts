import type { User, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ installed: vi.fn(), raw: vi.fn(), execute: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.raw, $executeRaw: mocks.execute, auditLog: { create: mocks.audit } } }));
vi.mock("./extensions", () => ({ extensionsInstalled: mocks.installed }));
import { recordBookingConversion } from "./experiments";
const tx = { $queryRaw: mocks.raw, $executeRaw: mocks.execute, auditLog: { create: mocks.audit } } as unknown as Prisma.TransactionClient;
describe("consented server-side experiment conversions", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.installed.mockResolvedValue(true); mocks.raw.mockResolvedValue([]); });
  it("does not query unavailable experiment storage", async () => {
    mocks.installed.mockResolvedValue(false);
    await recordBookingConversion({ id: "user-a", role: "PATIENT" } as User, "booking-a", tx);
    expect(mocks.raw).not.toHaveBeenCalled();
  });
  it("does not record a conversion without an opted-in exposure", async () => {
    await recordBookingConversion({ id: "user-a", role: "PATIENT" } as User, "booking-a", tx);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("locks the account and caps conversions per day without copying booking data into analytics", async () => {
    mocks.raw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "exposure" }]).mockResolvedValueOnce([]);
    await recordBookingConversion({ id: "user-a", role: "PATIENT" } as User, "booking-a", tx);
    expect(mocks.raw.mock.calls[0][0].join("?")).toContain("FOR UPDATE");
    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.execute.mock.calls[0][0].join("?")).toContain("NOT EXISTS");
    expect(JSON.stringify(mocks.execute.mock.calls)).not.toContain("booking-a");
  });
});
