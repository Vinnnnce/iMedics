import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { POLICY_RELEASE } from "./release";
import { recordPolicyReceipt } from "./record";
function transaction(content: unknown = POLICY_RELEASE) {
  return {
    policySnapshot: { findUnique: vi.fn().mockResolvedValue(content ? { content } : null), findUniqueOrThrow: vi.fn().mockResolvedValue({ content: POLICY_RELEASE }), createMany: vi.fn() },
    policyReceipt: { createMany: vi.fn() },
  };
}
describe("immutable policy evidence", () => {
  it("creates a snapshot once and a draft acknowledgement, with no update", async () => {
    const tx = transaction(null);
    await recordPolicyReceipt(tx as unknown as Prisma.TransactionClient, "self", "DOCTOR");
    expect(tx.policySnapshot.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(tx.policyReceipt.createMany).toHaveBeenCalledWith({ data: [{ userId: "self", version: POLICY_RELEASE.version, accountType: "DOCTOR", kind: "DRAFT_ACKNOWLEDGEMENT" }], skipDuplicates: true });
  });
  it("refuses altered text under an existing version", async () => {
    const tx = transaction({ ...POLICY_RELEASE, jurisdiction: "altered" });
    await expect(recordPolicyReceipt(tx as unknown as Prisma.TransactionClient, "self", "PATIENT")).rejects.toThrow("version update");
    expect(tx.policyReceipt.createMany).not.toHaveBeenCalled();
  });
  it("accepts equivalent JSONB key ordering without overwriting history", async () => {
    const tx = transaction(Object.fromEntries(Object.entries(POLICY_RELEASE).reverse()));
    await recordPolicyReceipt(tx as unknown as Prisma.TransactionClient, "self", "PATIENT");
    expect(tx.policySnapshot.createMany).not.toHaveBeenCalled();
    expect(tx.policyReceipt.createMany).toHaveBeenCalledOnce();
  });
});
