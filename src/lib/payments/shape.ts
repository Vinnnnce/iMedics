import type { Prisma } from "@prisma/client";

export const paymentSelect = {
  id: true,
  kind: true,
  description: true,
  amount: true,
  currency: true,
  method: true,
  status: true,
  receiptNumber: true,
  failureReason: true,
  expiresAt: true,
  paidAt: true,
  refundedAt: true,
  createdAt: true,
  appointmentId: true,
  facilityBookingId: true,
  payerId: true,
  payeeId: true,
  payer: { select: { name: true } },
  payee: { select: { name: true } },
} satisfies Prisma.PaymentSelect;

export type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;

/** API shape: amount as a number, party names flattened, and what the viewer's role means for this payment. */
export function serializePayment(payment: PaymentRow, viewerId: string) {
  const { amount, payer, payee, payerId, payeeId, ...rest } = payment;
  return {
    ...rest,
    amount: Number(amount),
    payerName: payer.name,
    payeeName: payee.name,
    direction: viewerId === payerId ? ("PAID" as const) : viewerId === payeeId ? ("RECEIVED" as const) : null,
  };
}
export type SerializedPayment = ReturnType<typeof serializePayment>;

/** Where a payer goes to complete or retry this payment. */
export const isPayable = (p: { status: string; expiresAt: Date | string | null }) =>
  (p.status === "PENDING" || p.status === "FAILED") && (!p.expiresAt || new Date(p.expiresAt) > new Date());
