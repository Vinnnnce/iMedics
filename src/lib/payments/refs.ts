import { randomBytes } from "node:crypto";
import { PAYMENT_HOLD_MINUTES } from "./config";

/** A fresh gateway reference for a charge (unique across all attempts). */
export const newReference = () => `MC-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`.toUpperCase();

export const newReceiptNumber = () =>
  `RCT-${new Date().toISOString().slice(0, 7).replace("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;

/** How long an unpaid booking holds its slot before it is released. */
export const holdExpiry = (now = new Date()) => new Date(now.getTime() + PAYMENT_HOLD_MINUTES * 60_000);
