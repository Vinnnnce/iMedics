import { describe, expect, it } from "vitest";
import { diffReconciliation, type LocalPaymentRow } from "./reconciliation";
import type { GatewayTransaction } from "./payments/provider";

const local = (overrides: Partial<LocalPaymentRow> = {}): LocalPaymentRow => ({
  id: "p1",
  providerReference: "MC-REF-1",
  amountMinor: 100_000,
  currency: "NGN",
  status: "SUCCESSFUL",
  appointmentId: "a1",
  facilityBookingId: null,
  ...overrides,
});

const gateway = (overrides: Partial<GatewayTransaction> = {}): GatewayTransaction => ({
  reference: "MC-REF-1",
  amountMinor: 100_000,
  currency: "NGN",
  status: "success",
  ...overrides,
});

const resolveLocal = (reference: string) => (reference === "MC-REF-2" ? local({ id: "p2", providerReference: "MC-REF-2" }) : null);

describe("diffReconciliation", () => {
  it("reports nothing when local and gateway agree", () => {
    expect(diffReconciliation([local()], [gateway()], resolveLocal)).toEqual([]);
  });

  it("flags a missing webhook when the money moved but our payment is still open", () => {
    const drafts = diffReconciliation([local({ status: "PENDING" })], [gateway()], resolveLocal);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe("MISSING_WEBHOOK");
    expect(drafts[0].severity).toBe("CRITICAL");
  });

  it("flags a gateway record we have no payment for", () => {
    const drafts = diffReconciliation([], [gateway({ reference: "MC-REF-X" })], resolveLocal);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe("ORPHANED_GATEWAY_RECORD");
  });

  it("flags mismatched amounts on a settled payment", () => {
    const drafts = diffReconciliation([local({ amountMinor: 90_000 })], [gateway()], resolveLocal);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe("AMOUNT_MISMATCH");
    expect(drafts[0].expected).toEqual({ amountMinor: 90_000 });
    expect(drafts[0].actual).toEqual({ amountMinor: 100_000 });
  });

  it("flags a settled payment the gateway has no record of", () => {
    const drafts = diffReconciliation([local({ providerReference: "MC-REF-9" })], [], resolveLocal);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe("FAILED_SETTLEMENT");
  });

  it("does not flag a settled payment whose earlier charge attempt appears in the gateway report", () => {
    // A retry succeeded under MC-REF-1 but the payment's latest reference is MC-REF-2: the
    // resolver knows the earlier attempt belongs to that payment (as the production resolver
    // does for every checkout attempt), so it must not raise a false settlement warning.
    const resolveEarlier = (reference: string) =>
      reference === "MC-REF-1" ? local({ providerReference: "MC-REF-2" }) : null;
    expect(diffReconciliation([local({ providerReference: "MC-REF-2" })], [gateway({ reference: "MC-REF-1" })], resolveEarlier)).toEqual([]);
    // An unknown gateway reference still cannot vouch for the payment.
    const unknown = diffReconciliation([local({ providerReference: "MC-REF-2" })], [gateway({ reference: "MC-REF-1" })], resolveLocal);
    expect(unknown.some((d) => d.type === "FAILED_SETTLEMENT")).toBe(true);
  });

  it("does not let a failed gateway row under the current reference vouch for a settled payment", () => {
    // The gateway row exists but FAILED: it cannot vouch for a payment we believe succeeded.
    const drafts = diffReconciliation([local()], [gateway({ status: "failed" })], resolveLocal);
    const warning = drafts.find((d) => d.type === "FAILED_SETTLEMENT");
    expect(warning).toBeDefined();
    // A foreign-currency success cannot vouch either.
    const foreign = diffReconciliation([local()], [gateway({ currency: "USD" })], resolveLocal);
    expect(foreign.some((d) => d.type === "FAILED_SETTLEMENT")).toBe(true);
  });

  it("flags duplicate successful charges for the same booking", () => {
    const first = local();
    const second = local({ id: "p2", providerReference: "MC-REF-2" });
    const drafts = diffReconciliation([first, second], [gateway(), gateway({ reference: "MC-REF-2" })], resolveLocal);
    const duplicate = drafts.find((d) => d.type === "DUPLICATE_PAYMENT");
    expect(duplicate).toBeDefined();
    expect(duplicate?.actual).toMatchObject({ successfulCharges: 2 });
  });

  it("ignores local payments that were never settled", () => {
    expect(diffReconciliation([local({ status: "PENDING" })], [], resolveLocal)).toEqual([]);
    expect(diffReconciliation([local({ status: "CANCELLED" })], [], resolveLocal)).toEqual([]);
  });
});
