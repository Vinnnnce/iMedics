import { z } from "zod";

/** Currencies the platform can charge in (matches what the payment gateway supports for our markets). */
export const SUPPORTED_CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "USD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "NGN";

export const MAX_FEE = 100_000_000;

export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

/** A non-negative price with at most two decimal places. */
export const priceSchema = z
  .number()
  .min(0, "Price cannot be negative")
  .max(MAX_FEE, "Price is too high")
  .refine((v) => Math.round(v * 100) / 100 === v, "Use at most two decimal places");

/** "₦5,000.00", "GH₵120.00", "$40.00". Falls back to "CODE 12.00" for unknown currencies. */
export function formatMoney(amount: number | string, currency: string): string {
  const value = Number(amount);
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Smallest currency unit (kobo, pesewas, cents) as an integer, for payment gateways. */
export function toMinorUnits(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}
