import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));
vi.mock("./prisma", () => ({ prisma: {} }));

import { resolveCommission } from "./commissions";
import type { CommissionRule } from "@prisma/client";

const rule = (overrides: Partial<CommissionRule> = {}): CommissionRule =>
  ({
    id: "rule-1",
    providerType: "DOCTOR",
    facilityId: null,
    kind: "PERCENT",
    value: { toString: () => "10" } as never,
    currency: null,
    active: true,
    note: null,
    createdById: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as unknown as CommissionRule;

const dbWithRules = (rules: CommissionRule[]) =>
  ({ commissionRule: { findMany: vi.fn().mockResolvedValue(rules) } }) as never;

describe("resolveCommission", () => {
  it("takes no commission when no rule exists", async () => {
    const split = await resolveCommission("DOCTOR", 10_000, dbWithRules([]));
    expect(split).toMatchObject({ commission: 0, provider: 10_000, ruleId: null });
  });

  it("applies a percentage commission", async () => {
    const split = await resolveCommission("DOCTOR", 10_000, dbWithRules([rule()]));
    expect(split.commission).toBe(1000);
    expect(split.provider).toBe(9000);
  });

  it("caps a flat commission at the charge amount", async () => {
    const split = await resolveCommission("DOCTOR", 500, dbWithRules([rule({ kind: "FIXED", value: { toString: () => "2000" } as never })]));
    expect(split.commission).toBe(500);
    expect(split.provider).toBe(0);
  });

  it("prefers a facility-specific rule over the type default", async () => {
    // The database returns facility-specific rules before type defaults (see orderBy).
    const rules = [rule({ id: "rule-2", facilityId: "f1", value: { toString: () => "25" } as never }), rule()];
    const split = await resolveCommission("LABORATORY", 10_000, dbWithRules(rules), "f1");
    expect(split.commission).toBe(2500);
    expect(split.ruleId).toBe("rule-2");
  });
});
