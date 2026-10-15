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
