import type { CommissionKind, Prisma, PrismaClient, ProviderType } from "@prisma/client";
import { prisma } from "./prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/** The split of a charge between Medic1905 (commission) and the provider (earnings). */
export interface CommissionSplit {
  /** Medic1905's commission, in major currency units. */
  commission: number;
  /** The provider's earnings, in major currency units. */
  provider: number;
  /** The rule that produced this split, for the payment's audit trail. */
  ruleId: string | null;
  kind: CommissionKind | null;
  /** The rule's raw value: the percentage for PERCENT rules, null otherwise. */
  percent: number | null;
}

/**
 * Resolve the commission for a charge. A facility-specific rule (facilityId set) overrides the
 * default active rule for the provider type. No rule at all means Medic1905 takes nothing and
 * the provider's subaccount receives the full amount.
 */
export async function resolveCommission(
  providerType: ProviderType,
  amount: number,
  db: Db = prisma,
  facilityId?: string | null,
): Promise<CommissionSplit> {
  const rules = await db.commissionRule.findMany({
    where: {
      providerType,
      active: true,
      OR: [{ facilityId: null }, ...(facilityId ? [{ facilityId }] : [])],
    },
    orderBy: [{ facilityId: { sort: "desc", nulls: "last" } }],
  });
  const rule = rules[0];
  if (!rule) return { commission: 0, provider: amount, ruleId: null, kind: null, percent: null };

  const value = Number(rule.value);
  const commission =
    rule.kind === "PERCENT" ? round2((amount * value) / 100) : Math.min(round2(value), amount);
  return { commission, provider: round2(amount - commission), ruleId: rule.id, kind: rule.kind, percent: rule.kind === "PERCENT" ? value : null };
}

/** Commission in percent for a provider type, used when creating the gateway subaccount. */
export async function commissionPercentFor(
  providerType: ProviderType,
  db: Db = prisma,
  facilityId?: string | null,
): Promise<number> {
  const rules = await db.commissionRule.findMany({
    where: {
      providerType,
      active: true,
      kind: "PERCENT",
      OR: [{ facilityId: null }, ...(facilityId ? [{ facilityId }] : [])],
    },
    orderBy: [{ facilityId: { sort: "desc", nulls: "last" } }],
    take: 1,
  });
  return rules[0] ? Number(rules[0].value) : 0;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
