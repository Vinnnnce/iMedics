import { describe, expect, it } from "vitest";
import { computeCommissionSplit, defaultCommissionBps } from "./config";

describe("commission split", () => {
  it("splits a charge so the facility keeps the net and Medic1905 only its commission", () => {
    const split = computeCommissionSplit(10_000, { commissionBps: 500, subaccountCode: "ACCT_x" });
    expect(split.commissionBps).toBe(500);
    expect(split.commissionAmount).toBe(500);
    expect(split.netAmount).toBe(9_500);
    expect(split.settlementMode).toBe("SPLIT_SUBACCOUNT");
    expect(split.subaccountCode).toBe("ACCT_x");
  });

  it("falls back to the platform default when the facility has no override", () => {
    const split = computeCommissionSplit(2_000, { commissionBps: null, subaccountCode: null }, 500);
    expect(split.commissionAmount).toBe(100);
    expect(split.netAmount).toBe(1_900);
    expect(split.settlementMode).toBe("PLATFORM_HELD");
  });

  it("marks funds platform-held when no subaccount is configured", () => {
    const split = computeCommissionSplit(1_000, { commissionBps: 500, subaccountCode: null });
    expect(split.settlementMode).toBe("PLATFORM_HELD");
    expect(split.subaccountCode).toBeNull();
    // The split is still recorded as an accounting snapshot owed to the facility.
    expect(split.commissionAmount).toBe(50);
    expect(split.netAmount).toBe(950);
  });

  it("handles zero commission and rounds sensibly", () => {
    const zero = computeCommissionSplit(10_000, { commissionBps: 0, subaccountCode: "ACCT_x" });
    expect(zero.commissionAmount).toBe(0);
    expect(zero.netAmount).toBe(10_000);

    const rounded = computeCommissionSplit(33.33, { commissionBps: 500, subaccountCode: null });
    expect(rounded.commissionAmount).toBe(1.67);
    expect(rounded.netAmount).toBe(31.66);
  });

  it("never returns a negative net amount", () => {
    const split = computeCommissionSplit(1, { commissionBps: 10_000, subaccountCode: null });
    expect(split.netAmount).toBeGreaterThanOrEqual(0);
  });

  it("reads the platform default from configuration", () => {
    expect(defaultCommissionBps()).toBeGreaterThanOrEqual(0);
    expect(defaultCommissionBps()).toBeLessThanOrEqual(10_000);
  });
});
