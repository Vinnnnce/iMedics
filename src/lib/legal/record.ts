import { Prisma } from "@prisma/client";
import { POLICY_RELEASE, policyCanBeAccepted } from "./release";
import { conflict } from "@/lib/errors";

export async function recordPolicyReceipt(tx: Prisma.TransactionClient, userId: string, accountType: string) {
  const content = JSON.parse(JSON.stringify(POLICY_RELEASE)) as Prisma.InputJsonValue;
  const existing = await tx.policySnapshot.findUnique({ where: { version: POLICY_RELEASE.version } });
  if (existing && JSON.stringify(existing.content) !== JSON.stringify(content)) {
    // JSONB key order is not stable: compare structurally, never overwrite evidence.
    const { isDeepStrictEqual } = await import("node:util");
    if (!isDeepStrictEqual(existing.content, content)) throw conflict("Policy text changed without a version update. Contact support.");
  }
  if (!existing) {
    // Concurrent first registrations are safe. No UPDATE is issued against immutable snapshots.
    await tx.policySnapshot.createMany({ data: [{ version: POLICY_RELEASE.version, status: POLICY_RELEASE.status, effectiveDate: POLICY_RELEASE.effectiveDate, content }], skipDuplicates: true });
    const stored = await tx.policySnapshot.findUniqueOrThrow({ where: { version: POLICY_RELEASE.version } });
    const { isDeepStrictEqual } = await import("node:util");
    if (!isDeepStrictEqual(stored.content, content)) throw conflict("Policy version conflict. Contact support.");
  }
  const kind = policyCanBeAccepted() ? "ACCEPTANCE" : "DRAFT_ACKNOWLEDGEMENT";
  await tx.policyReceipt.createMany({
    data: [{ userId, version: POLICY_RELEASE.version, accountType, kind }],
    skipDuplicates: true,
  });
}
