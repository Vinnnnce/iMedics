import type { PaymentMethod } from "@prisma/client";

/** How long an unpaid booking holds its slot before it is released. */
export const PAYMENT_HOLD_MINUTES = 30;

/** Patients cancelling a confirmed appointment get a full refund at least this long before it starts. */
export const REFUND_CUTOFF_HOURS = 24;

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; description: string; currencies: readonly string[] }> = {
  CARD: { label: "Card", description: "Debit or credit card", currencies: ["NGN", "GHS", "KES", "ZAR", "USD"] },
  BANK_TRANSFER: { label: "Bank transfer", description: "Pay from your banking app", currencies: ["NGN"] },
  USSD: { label: "USSD", description: "Pay with a code on your phone", currencies: ["NGN"] },
  MOBILE_MONEY: { label: "Mobile money", description: "MTN, M-PESA and others", currencies: ["GHS", "KES"] },
};

export function methodsForCurrency(currency: string): PaymentMethod[] {
  return (Object.keys(PAYMENT_METHODS) as PaymentMethod[]).filter((m) => PAYMENT_METHODS[m].currencies.includes(currency));
}

/** Gateway channel names used to restrict checkout to the method the patient chose. */
export const GATEWAY_CHANNELS: Record<PaymentMethod, string[]> = {
  CARD: ["card"],
  BANK_TRANSFER: ["bank_transfer", "bank"],
  USSD: ["ussd"],
  MOBILE_MONEY: ["mobile_money"],
};

/** Best-effort mapping from the gateway's reported channel back to our method. */
export function methodFromChannel(channel: string | undefined): PaymentMethod | null {
  switch (channel) {
    case "card":
      return "CARD";
    case "bank_transfer":
    case "bank":
      return "BANK_TRANSFER";
    case "ussd":
      return "USSD";
    case "mobile_money":
      return "MOBILE_MONEY";
    default:
      return null;
  }
}

/** Statuses in which money is held by the platform for a completed charge. */
export const PAID_STATUSES = ["SUCCESSFUL", "REFUND_PENDING", "REFUNDED"] as const;

/**
 * Medic1905 commission on facility services, in basis points. The platform default
 * is environment configuration (MEDIC_COMMISSION_BPS); a facility-specific value
 * set by the platform overrides it. 500 bps = 5%.
 */
export function defaultCommissionBps(): number {
  const parsed = Number.parseInt(process.env.MEDIC_COMMISSION_BPS ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10_000 ? parsed : 500;
}

export interface FacilityCommissionTerms {
  commissionBps: number | null;
  subaccountCode: string | null;
}

export interface CommissionSplit {
  commissionBps: number;
  commissionAmount: number;
  netAmount: number;
  settlementMode: "PLATFORM_HELD" | "SPLIT_SUBACCOUNT";
  subaccountCode: string | null;
}

/**
 * Snapshot the commission terms for a facility service charge. The facility gets
 * the service fee minus the Medic1905 commission; Medic1905 receives only its
 * commission. When no subaccount is configured the platform holds the funds
 * (settlementMode PLATFORM_HELD) — the split is then an accounting snapshot owed
 * to the facility, not a gateway-level split.
 */
export function computeCommissionSplit(
  amount: number,
  terms: FacilityCommissionTerms,
  platformBps = defaultCommissionBps(),
): CommissionSplit {
  const commissionBps = terms.commissionBps ?? platformBps;
  const commissionAmount = Math.round(((amount * commissionBps) / 10_000) * 100) / 100;
  const netAmount = Math.max(0, Math.round((amount - commissionAmount) * 100) / 100);
  return {
    commissionBps,
    commissionAmount,
    netAmount,
    settlementMode: terms.subaccountCode ? "SPLIT_SUBACCOUNT" : "PLATFORM_HELD",
    subaccountCode: terms.subaccountCode,
  };
}
