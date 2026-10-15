import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { getPaymentProvider } from "./provider";

const secret = "sk_test_secret";
const sign = (body: string) => createHmac("sha512", secret).update(body).digest("hex");

afterEach(() => {
  delete process.env.PAYSTACK_SECRET_KEY;
  delete process.env.PAYMENT_PROVIDER;
});

describe("Paystack webhook parsing", () => {
  const provider = () => {
    process.env.PAYSTACK_SECRET_KEY = secret;
    return getPaymentProvider();
  };

  it("rejects a missing or wrong signature", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "R1", amount: 100, currency: "NGN" } });
    expect(provider().parseWebhook(body, null).valid).toBe(false);
    expect(provider().parseWebhook(body, "deadbeef").valid).toBe(false);
    expect(provider().parseWebhook(body, sign(body + " ")).valid).toBe(false);
  });

  it("accepts a correctly signed charge.success", () => {
    const body = JSON.stringify({ event: "charge.success", data: { reference: "R1", amount: 500000, currency: "NGN", channel: "card" } });
    const result = provider().parseWebhook(body, sign(body));
    expect(result.valid).toBe(true);
    expect(result.event).toEqual({ type: "charge.success", reference: "R1", amountMinor: 500000, currency: "NGN", channel: "card" });
  });

  it("reads the original transaction reference on refund events", () => {
    const body = JSON.stringify({ event: "refund.processed", data: { transaction_reference: "R2", refund_reference: "X" } });
    expect(provider().parseWebhook(body, sign(body)).event).toEqual({ type: "refund.processed", reference: "R2" });
  });

  it("is valid but ignores events we do not act on", () => {
    const body = JSON.stringify({ event: "transfer.success", data: {} });
    expect(provider().parseWebhook(body, sign(body))).toEqual({ valid: true, event: null });
  });
});

describe("provider selection", () => {
  it("never allows the mock provider in production", () => {
    process.env.PAYMENT_PROVIDER = "mock";
    const env = process.env as Record<string, string | undefined>;
    const original = env.NODE_ENV;
    env.NODE_ENV = "production";
    expect(() => getPaymentProvider()).toThrow(/production/);
    env.NODE_ENV = original;
  });
});
