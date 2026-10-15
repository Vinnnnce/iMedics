import { randomBytes } from "node:crypto";
import type { Payment, PaymentKind, PaymentMethod, Prisma, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { ApiError, badRequest, conflict, notFound } from "../errors";
import { toMinorUnits } from "../money";
import { queueNotification } from "../notifications/service";
import { PAYMENT_HOLD_MINUTES, REFUND_CUTOFF_HOURS, methodFromChannel, methodsForCurrency } from "./config";
import { getPaymentProvider, type WebhookEvent } from "./provider";
import { appUrl } from "../notifications/email";

type Tx = Prisma.TransactionClient;

export const newReference = () => `MC-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`.toUpperCase();
const newReceiptNumber = () => `RCT-${new Date().toISOString().slice(0, 7).replace("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;

export const holdExpiry = (now = new Date()) => new Date(now.getTime() + PAYMENT_HOLD_MINUTES * 60_000);

/** Fail early, with a clear message, when no payment gateway is configured. */
export function assertPaymentsAvailable(): void {
  try {
    getPaymentProvider();
  } catch {
    throw new ApiError(503, "Payments are not available right now. Please try again later.");
  }
}

function recordEvent(db: Tx | typeof prisma, paymentId: string, type: string, details: Prisma.InputJsonValue = {}) {
  return db.payment.update({ where: { id: paymentId }, data: { events: { create: { type, details } } }, select: { id: true } });
}

interface NewPayment {
  kind: PaymentKind;
  payerId: string;
  payeeId: string;
  appointmentId?: string;
  facilityBookingId?: string;
  description: string;
  amount: number;
  currency: string;
}

/** Create the pending charge for a booking. Call inside the booking transaction so both succeed or fail together. */
export function createPendingPayment(tx: Tx, input: NewPayment) {
  return tx.payment.create({
    data: {
      ...input,
      provider: getPaymentProvider().name,
      providerReference: newReference(),
      expiresAt: holdExpiry(),
      events: { create: { type: "CREATED", details: {} } },
    },
  });
}

/** Resolve a gateway reference to our payment. Earlier checkout attempts for the same payment still count. */
export async function findPaymentByReference(reference: string) {
  return prisma.payment.findFirst({
    where: {
      OR: [
        { providerReference: reference },
        { events: { some: { type: "CHECKOUT_STARTED", details: { path: ["reference"], equals: reference } } } },
      ],
    },
  });
}

/** Payer picks a method and gets a gateway checkout link. Each attempt uses a fresh gateway reference. */
export async function startCheckout(paymentId: string, payer: { id: string; email: string }, method: PaymentMethod) {
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, payerId: payer.id } });
  if (!payment) throw notFound("Payment not found");
  if (payment.status !== "PENDING" && payment.status !== "FAILED") throw conflict("This payment can no longer be started");
  if (payment.expiresAt && payment.expiresAt <= new Date()) throw conflict("This booking has expired. Please book again.");
  if (!methodsForCurrency(payment.currency).includes(method)) throw badRequest("That payment method is not available for this currency");

  const provider = getPaymentProvider();
  const reference = newReference();
  const { checkoutUrl } = await provider.initialize({
    reference,
    amountMinor: toMinorUnits(payment.amount.toString()),
    currency: payment.currency,
    email: payer.email,
    method,
    callbackUrl: `${appUrl()}/payments/callback`,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerReference: reference,
      method,
      status: "PENDING",
      failureReason: null,
      events: { create: { type: "CHECKOUT_STARTED", details: { reference, method } } },
    },
  });
  return { checkoutUrl, reference };
}

export type ProviderOutcome =
  | { status: "success"; amountMinor: number; currency: string; channel?: string }
  | { status: "failed"; reason?: string };

/**
 * Apply what the gateway told us (via webhook or verification). Idempotent: repeated or concurrent calls
 * change the payment once, and side effects (notifications, refunds) run only for the call that won.
 */
export async function applyProviderOutcome(reference: string, outcome: ProviderOutcome): Promise<Payment | null> {
  const payment = await findPaymentByReference(reference);
  if (!payment) return null;

  if (outcome.status === "failed") {
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "FAILED", failureReason: outcome.reason?.slice(0, 200) ?? "The payment was not completed" },
    });
    if (claimed.count > 0) {
      await recordEvent(prisma, payment.id, "FAILED", { reference });
      queueNotification(payment.payerId, { kind: "PAYMENT_FAILED", paymentId: payment.id });
    }
    return prisma.payment.findUnique({ where: { id: payment.id } });
  }

  if (outcome.amountMinor !== toMinorUnits(payment.amount.toString()) || outcome.currency !== payment.currency) {
    console.error(`Payment ${payment.id}: gateway amount/currency does not match`);
    await recordEvent(prisma, payment.id, "AMOUNT_MISMATCH", { reference, amountMinor: outcome.amountMinor, currency: outcome.currency });
    return payment;
  }

  const lateAfterCancel = payment.status === "CANCELLED";
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: { in: ["PENDING", "FAILED", "CANCELLED"] } },
    data: {
      status: "SUCCESSFUL",
      paidAt: new Date(),
      failureReason: null,
      method: methodFromChannel(outcome.channel) ?? payment.method,
      receiptNumber: payment.receiptNumber ?? newReceiptNumber(),
    },
  });
  if (claimed.count === 0) return payment; // already settled by another call

  await recordEvent(prisma, payment.id, "SUCCEEDED", { reference });

  if (lateAfterCancel) {
    // The booking was released while the payment was in flight. Give the money straight back.
    await requestRefund(payment.id, "Payment completed after the booking was released");
  } else {
    queueNotification(payment.payerId, { kind: "PAYMENT_SUCCESSFUL", paymentId: payment.id });
    // The provider hears about the booking only once it is paid.
    if (payment.appointmentId) queueNotification(payment.payeeId, { kind: "APPOINTMENT_REQUESTED", appointmentId: payment.appointmentId });
    if (payment.facilityBookingId) queueNotification(payment.payeeId, { kind: "FACILITY_BOOKING_REQUESTED", bookingId: payment.facilityBookingId });
  }
  return prisma.payment.findUnique({ where: { id: payment.id } });
}

/** Ask the gateway for the truth about a payment that is still open (used on return from checkout). */
export async function verifyOpenPayment(payment: Payment): Promise<Payment> {
  if (payment.status !== "PENDING" && payment.status !== "FAILED") return payment;
  const result = await getPaymentProvider().verify(payment.providerReference);
  if (result.status === "success") {
    return (await applyProviderOutcome(payment.providerReference, { status: "success", amountMinor: result.amountMinor, currency: result.currency, channel: result.channel })) ?? payment;
  }
  if (result.status === "failed") {
    return (await applyProviderOutcome(payment.providerReference, { status: "failed", reason: result.message })) ?? payment;
  }
  return payment;
}

export async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
  if (event.type === "charge.success") {
    await applyProviderOutcome(event.reference, { status: "success", amountMinor: event.amountMinor, currency: event.currency, channel: event.channel });
    return;
  }
  const payment = await findPaymentByReference(event.reference);
  if (!payment) return;
  if (event.type === "refund.processed") await markRefunded(payment.id);
  else await recordEvent(prisma, payment.id, event.type.toUpperCase().replace(".", "_"), { reference: event.reference });
}

/** Begin refunding a successful payment in full. Safe to call twice. */
export async function requestRefund(paymentId: string, reason: string): Promise<void> {
  const claimed = await prisma.payment.updateMany({ where: { id: paymentId, status: "SUCCESSFUL" }, data: { status: "REFUND_PENDING" } });
  if (claimed.count === 0) return;
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await recordEvent(prisma, paymentId, "REFUND_REQUESTED", { reason });
  queueNotification(payment.payerId, { kind: "PAYMENT_REFUND_PENDING", paymentId });
  await submitRefund(payment);
}

/** Send the refund request to the gateway. Failures are recorded and retried by the scheduled job. */
export async function submitRefund(payment: Payment): Promise<void> {
  try {
    const result = await getPaymentProvider().refund(payment.providerReference);
    await recordEvent(prisma, payment.id, "REFUND_ACCEPTED", { gatewayStatus: result.status });
    if (result.status === "processed") await markRefunded(payment.id);
  } catch (error) {
    console.error(`Refund request for payment ${payment.id} failed:`, error);
    await recordEvent(prisma, payment.id, "REFUND_REQUEST_FAILED", {});
  }
}

export async function markRefunded(paymentId: string): Promise<void> {
  const claimed = await prisma.payment.updateMany({
    where: { id: paymentId, status: "REFUND_PENDING" },
    data: { status: "REFUNDED", refundedAt: new Date() },
  });
  if (claimed.count === 0) return;
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { payerId: true } });
  await recordEvent(prisma, paymentId, "REFUNDED");
  queueNotification(payment.payerId, { kind: "PAYMENT_REFUNDED", paymentId });
}

/**
 * Whether cancelling earns a full refund. Providers cancelling always refund; a patient gets their money back if the
 * provider never confirmed the booking or if they cancel at least REFUND_CUTOFF_HOURS before it starts.
 */
export function isRefundEligible(input: { cancelledBy: Role; wasConfirmed: boolean; startsAt: Date; now?: Date }): boolean {
  if (input.cancelledBy !== "PATIENT") return true;
  if (!input.wasConfirmed) return true;
  const hoursAhead = (input.startsAt.getTime() - (input.now ?? new Date()).getTime()) / 3_600_000;
  return hoursAhead >= REFUND_CUTOFF_HOURS;
}

/** A booking was cancelled: close an unpaid charge, or refund a paid one when the policy allows. */
export async function settlePaymentOnCancellation(payment: Payment | null, refund: boolean, reason: string): Promise<void> {
  if (!payment) return;
  if (payment.status === "PENDING" || payment.status === "FAILED") {
    const claimed = await prisma.payment.updateMany({ where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "CANCELLED" } });
    if (claimed.count > 0) await recordEvent(prisma, payment.id, "CANCELLED", { reason });
  } else if (payment.status === "SUCCESSFUL" && refund) {
    await requestRefund(payment.id, reason);
  }
}

/**
 * Release slots held by bookings whose payment was never completed, and retry refunds the gateway has not
 * accepted yet. Cheap enough to call before availability checks and from the scheduled job.
 */
export async function expireStalePayments(now = new Date()): Promise<number> {
  const stale = await prisma.payment.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, expiresAt: { lt: now } },
    take: 100,
  });

  let released = 0;
  for (const payment of stale) {
    // The customer may have paid just before the deadline while the webhook is still on its way.
    if (payment.status === "PENDING" && payment.method) {
      try {
        const settled = await verifyOpenPayment(payment);
        if (settled.status !== "PENDING" && settled.status !== "FAILED") continue;
      } catch {
        /* gateway unreachable: fall through and release the slot; a late payment is refunded automatically */
      }
    }
    const done = await prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "CANCELLED" } });
      if (claimed.count === 0) return false;
      if (payment.appointmentId) await tx.appointment.updateMany({ where: { id: payment.appointmentId, status: "BOOKED" }, data: { status: "CANCELLED" } });
      if (payment.facilityBookingId) await tx.facilityBooking.updateMany({ where: { id: payment.facilityBookingId, status: "REQUESTED" }, data: { status: "CANCELLED" } });
      await recordEvent(tx, payment.id, "EXPIRED");
      return true;
    });
    if (done) released += 1;
  }

  // Refunds that were requested but never accepted by the gateway.
  const stuck = await prisma.payment.findMany({
    where: {
      status: "REFUND_PENDING",
      updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) },
      events: { none: { type: "REFUND_ACCEPTED" } },
    },
    take: 20,
  });
  for (const payment of stuck) await submitRefund(payment);

  return released;
}
