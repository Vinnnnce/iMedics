import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { recordPolicyReceipt } from "./record";
import { POLICY_RELEASE } from "./release";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("policy evidence PostgreSQL invariants (disposable database)", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url ?? "postgresql://unused" }) });
  const id = randomUUID();
  beforeAll(async () => {
    await prisma.user.create({ data: { id, name: "Synthetic evidence test", clerkId: `evidence-${id}`, email: `${id}@example.test`, role: "PATIENT" } });
  });
  afterAll(async () => {
    await prisma.user.updateMany({ where: { id }, data: { deletedAt: new Date() } });
    await prisma.$disconnect();
  });
  it("creates immutable snapshots, de-duplicates receipts and enforces owner foreign keys", async () => {
    await prisma.$transaction(tx => recordPolicyReceipt(tx, id, "PATIENT"));
    await prisma.$transaction(tx => recordPolicyReceipt(tx, id, "PATIENT"));
    expect(await prisma.policyReceipt.count({ where: { userId: id } })).toBe(1);
    const receipt = await prisma.policyReceipt.findFirstOrThrow({ where: { userId: id } });
    expect(receipt.kind).toBe("DRAFT_ACKNOWLEDGEMENT");
    await expect(prisma.policySnapshot.update({ where: { version: POLICY_RELEASE.version }, data: { status: "PUBLISHED" } })).rejects.toThrow();
    await expect(prisma.policyReceipt.update({ where: { id: receipt.id }, data: { accountType: "DOCTOR" } })).rejects.toThrow();
    await expect(prisma.policyReceipt.delete({ where: { id: receipt.id } })).rejects.toThrow();
    await expect(prisma.user.delete({ where: { id } })).rejects.toThrow();
  });
});
