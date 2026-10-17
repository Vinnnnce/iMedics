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
  /** Gateway subaccount the provider's share is settled to; the gateway keeps Medic1905's commission. */
  subaccountCode?: string;
  /** Flat platform commission for this charge (minor units), when the rule is FIXED. */
  commissionFixedMinor?: number;
}

export interface CreateSubaccountInput {
  businessName: string;
  settlementBank: string;
  accountNumber: string;
  /** Medic1905's commission in percent (0–100) deducted from each payment before settlement. Defaults to 0. */
  percentageCharge?: number;
}

export interface ListSettlementInput {
  /** Inclusive start of the settlement window. */
  from: Date;
  /** Inclusive end of the settlement window. */
  to: Date;
}

export interface GatewayTransaction {
  reference: string;
  amountMinor: number;
  currency: string;
  status: "success" | "failed" | "pending" | "abandoned" | string;
  paidAt?: Date;
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
  /** Creates a settlement subaccount for a verified provider/facility. Returns the gateway's subaccount code. */
  createSubaccount(input: CreateSubaccountInput): Promise<{ code: string }>;
  /** Keeps a subaccount's commission percentage in step with the current commission rule. */
  updateSubaccountCharge?(code: string, percentageCharge: number): Promise<void>;
  /** Reads a subaccount's live commission percentage from the gateway, for checkout-time verification. */
  getSubaccountCharge?(code: string): Promise<number>;
  /** Transactions the gateway reports for a window; used by daily reconciliation. */
  listTransactions?(input: ListSettlementInput): Promise<GatewayTransaction[]>;
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
          // When a provider subaccount is passed the gateway settles the provider's share to it
          // directly and keeps Medic1905's commission: the subaccount's percentage_charge for
          // PERCENT rules, or transaction_charge for a flat (FIXED) commission.
          ...(input.subaccountCode
            ? {
                subaccount: input.subaccountCode,
                bearer: "subaccount",
                // Zero is a valid flat commission: only an unset value is omitted.
                ...(input.commissionFixedMinor !== undefined ? { transaction_charge: input.commissionFixedMinor } : {}),
              }
            : {}),
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
    async createSubaccount(input) {
      const data = await call<{ subaccount_code: string }>("/subaccount", {
        method: "POST",
        body: JSON.stringify({
          business_name: input.businessName,
          settlement_bank: input.settlementBank,
          account_number: input.accountNumber,
          percentage_charge: input.percentageCharge ?? 0,
        }),
      });
      return { code: data.subaccount_code };
    },
    async updateSubaccountCharge(code, percentageCharge) {
      await call(`/subaccount/${encodeURIComponent(code)}`, {
        method: "PUT",
        body: JSON.stringify({ percentage_charge: percentageCharge }),
      });
    },
    async getSubaccountCharge(code) {
      const data = await call<{ percentage_charge?: number | string }>(`/subaccount/${encodeURIComponent(code)}`);
      return Number(data.percentage_charge ?? 0);
    },
    async listTransactions(input) {
      const transactions: GatewayTransaction[] = [];
      // Page through the gateway's transaction list for the window. The list endpoint's payload
      // IS the transaction array (the envelope is unwrapped by the `call` helper).
      for (let page = 1; page <= 50; page += 1) {
        const rows = await call<Array<Record<string, unknown>>>(
          `/transaction?from=${input.from.toISOString().slice(0, 10)}&to=${input.to.toISOString().slice(0, 10)}&perPage=100&page=${page}`,
        );
        for (const t of rows ?? []) {
          transactions.push({
            reference: String(t.reference),
            amountMinor: Number(t.amount),
            currency: String(t.currency),
            status: String(t.status),
            paidAt: t.paid_at ? new Date(String(t.paid_at)) : undefined,
          });
        }
        if ((rows?.length ?? 0) < 100) break;
      }
      return transactions;
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
  async createSubaccount(input) {
    return { code: `ACCT_MOCK_${input.accountNumber.slice(-4)}` };
  },
  async updateSubaccountCharge() {
    /* the mock gateway has nothing to update */
  },
  async getSubaccountCharge() {
    return 0;
  },
  async listTransactions() {
    return [];
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
