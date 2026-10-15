import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentMethod } from "@prisma/client";
import { GATEWAY_CHANNELS } from "./config";
import { appUrl } from "../notifications/email";

export interface InitializeInput {
  reference: string;
  amountMinor: number;
  currency: string;
  email: string;
  method: PaymentMethod;
  callbackUrl: string;
}

export interface VerifyResult {
  status: "success" | "failed" | "pending";
  amountMinor: number;
  currency: string;
  channel?: string;
  message?: string;
}

export type WebhookEvent =
  | { type: "charge.success"; reference: string; amountMinor: number; currency: string; channel?: string }
  | { type: "refund.processed" | "refund.failed" | "refund.pending"; reference: string };

export interface PaymentProvider {
  name: "PAYSTACK" | "MOCK";
  initialize(input: InitializeInput): Promise<{ checkoutUrl: string }>;
  verify(reference: string): Promise<VerifyResult>;
  /** Starts a full refund of a successful charge. "processed" means money has already been returned. */
  refund(reference: string): Promise<{ status: "pending" | "processed" }>;
  /** `valid` is false for a bad signature. A valid call can still carry an event we do not act on (event: null). */
  parseWebhook(rawBody: string, signature: string | null): { valid: boolean; event: WebhookEvent | null };
}

const PAYSTACK = "https://api.paystack.co";

function paystack(secret: string): PaymentProvider {
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${PAYSTACK}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...init?.headers },
    });
    const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
    if (!res.ok || !json?.status) throw new Error(`Paystack: ${json?.message ?? res.status}`);
    return json.data as T;
  };

  return {
    name: "PAYSTACK",
    async initialize(input) {
      const data = await call<{ authorization_url: string }>("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          amount: input.amountMinor,
          currency: input.currency,
          reference: input.reference,
          callback_url: input.callbackUrl,
          channels: GATEWAY_CHANNELS[input.method],
        }),
      });
      return { checkoutUrl: data.authorization_url };
    },
    async verify(reference) {
      const data = await call<{ status: string; amount: number; currency: string; channel?: string; gateway_response?: string }>(
        `/transaction/verify/${encodeURIComponent(reference)}`,
      );
      const status = data.status === "success" ? "success" : data.status === "failed" ? "failed" : "pending";
      return { status, amountMinor: data.amount, currency: data.currency, channel: data.channel, message: data.gateway_response };
    },
    async refund(reference) {
      const data = await call<{ status?: string }>("/refund", { method: "POST", body: JSON.stringify({ transaction: reference }) });
      return { status: data.status === "processed" ? "processed" : "pending" };
    },
    parseWebhook(rawBody, signature) {
      if (!signature) return { valid: false, event: null };
      const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
      const a = Buffer.from(expected);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false, event: null };

      const event = JSON.parse(rawBody) as { event?: string; data?: Record<string, unknown> };
      const data = event.data ?? {};
      switch (event.event) {
        case "charge.success":
          return {
            valid: true,
            event: {
              type: "charge.success",
              reference: String(data.reference),
              amountMinor: Number(data.amount),
              currency: String(data.currency),
              channel: typeof data.channel === "string" ? data.channel : undefined,
            },
          };
        case "refund.processed":
        case "refund.failed":
        case "refund.pending":
          return { valid: true, event: { type: event.event, reference: String(data.transaction_reference ?? data.reference) } };
        default:
          return { valid: true, event: null };
      }
    },
  };
}

/** Development stand-in: the "gateway" is a local page where you pick success or failure. Never used in production. */
const mock: PaymentProvider = {
  name: "MOCK",
  async initialize(input) {
    return { checkoutUrl: `${appUrl()}/payments/mock-checkout?reference=${encodeURIComponent(input.reference)}` };
  },
  async verify() {
    return { status: "pending", amountMinor: 0, currency: "" };
  },
  async refund() {
    return { status: "processed" };
  },
  parseWebhook() {
    return { valid: false, event: null };
  },
};

export function getPaymentProvider(): PaymentProvider {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const choice = (process.env.PAYMENT_PROVIDER || (secret ? "paystack" : "mock")).toLowerCase();
  if (choice === "paystack") {
    if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not set");
    return paystack(secret);
  }
  if (choice === "mock") {
    if (process.env.NODE_ENV === "production") throw new Error("The mock payment provider cannot be used in production");
    return mock;
  }
  throw new Error(`Unknown PAYMENT_PROVIDER "${choice}"`);
}
