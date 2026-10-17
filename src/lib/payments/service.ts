import type { Payment, PaymentKind, PaymentMethod, Prisma, Role } from "@prisma/client";
import { prisma } from "../prisma";
import { ApiError, badRequest, conflict, notFound } from "../errors";
import { toMinorUnits } from "../money";
import { queueNotification, queueAdminAlert } from "../notifications/service";
import { REFUND_CUTOFF_HOURS, methodFromChannel, methodsForCurrency } from "./config";
import { getPaymentProvider, type WebhookEvent } from "./provider";
import { appUrl } from "../notifications/email";
import { resolveCommission } from "../commissions";
import { activeSubaccountForUser } from "../subaccounts";
import { providerTypeForAccountType } from "../providers/types";
import { activateSubscriptionForPayment, recordConsultationUsage, markSubscriptionPaymentExpired } from "../subscriptions";
import { newReference, newReceiptNumber, holdExpiry } from "./refs";

type Tx = Prisma.TransactionClient;

export { newReference, holdExpiry };

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

  // Resolve the split for provider charges: Medic1905's commission and the provider's gateway
  // subaccount. Both are snapshotted on the payment so later rule changes never rewrite history,
  // and the gateway's split is verified (and aligned) against the rule before the charge starts.
  const split = await resolveSplitForPayment(payment);

  const { checkoutUrl } = await provider.initialize({
    reference,
    amountMinor: toMinorUnits(payment.amount.toString()),
    currency: payment.currency,
    email: payer.email,
    method,
    callbackUrl: `${appUrl()}/payments/callback`,
    ...(split.subaccountCode
      ? {
          subaccountCode: split.subaccountCode,
          // A flat commission travels with the transaction; a percentage is configured on the subaccount.
          ...(split.commissionKind === "FIXED" ? { commissionFixedMinor: toMinorUnits(String(split.commissionAmount ?? 0)) } : {}),
        }
      : {}),
  });

  // Claim the payment for this attempt conditionally: if it was settled or released while we
  // were initializing, this write claims nothing and the fresh gateway reference is never
  // recorded against it. (An initialized-but-unpaid charge moves no money; if the customer
  // somehow pays it anyway, the duplicate-charge path returns it.)
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } },
    data: {
      providerReference: reference,
      method,
      status: "PENDING",
      failureReason: null,
      commissionAmount: split.commissionAmount,
      providerAmount: split.providerAmount,
      subaccountCode: split.subaccountCode,
    },
  });
  if (claimed.count === 0) {
    throw conflict("This payment can no longer be started");
  }
  await recordEvent(prisma, payment.id, "CHECKOUT_STARTED", { reference, method });
  return { checkoutUrl, reference };
}

interface PaymentSplit {
  subaccountCode: string | null;
  commissionAmount: number | null;
  providerAmount: number | null;
  commissionKind: "PERCENT" | "FIXED" | null;
  /** Whether the payee is a provider whose charge must be split at the gateway. */
  isProviderCharge: boolean;
}

const noSplit: PaymentSplit = {
  subaccountCode: null,
  commissionAmount: null,
  providerAmount: null,
  commissionKind: null,
  isProviderCharge: false,
};

/**
 * Make the gateway's split for a subaccount match what we are about to snapshot on the payment.
 * A PERCENT rule lives on the subaccount's percentage_charge; a FIXED rule (or no rule at all,
 * which means Medic1905 takes nothing) must leave that percentage at zero, with the flat fee
 * travelling on the transaction instead. When the gateway can report the live value, it is
 * read back and verified — a stale local cache can never vouch for the gateway's actual state.
 */
async function alignSubaccountWithRule(
  payeeId: string,
  subaccount: { subaccountCode: string; percentageCharge: number },
  expectedPercent: number,
): Promise<void> {
  const provider = getPaymentProvider();
  if (subaccount.percentageCharge !== expectedPercent) {
    if (!provider.updateSubaccountCharge) {
      throw conflict("The payment gateway cannot enforce this commission split yet. Please try again later.");
    }
    try {
      await provider.updateSubaccountCharge(subaccount.subaccountCode, expectedPercent);
      await prisma.providerSubaccount.update({
        where: { userId: payeeId },
        data: { percentageCharge: expectedPercent },
      });
      subaccount = { ...subaccount, percentageCharge: expectedPercent };
    } catch (error) {
      console.error(`Could not align subaccount ${subaccount.subaccountCode} with the commission rule:`, error);
      throw conflict("This provider's commission settings could not be applied to their payout account yet, so this charge cannot be collected. Please try again later.");
    }
  }
  // Verify against the gateway itself when it can report its live value: the charge's actual
  // split is what the gateway will do, not what our cache last saw.
  if (provider.getSubaccountCharge) {
    let live: number;
    try {
      live = await provider.getSubaccountCharge(subaccount.subaccountCode);
    } catch (error) {
      console.error(`Could not read subaccount ${subaccount.subaccountCode} from the gateway:`, error);
      throw conflict("This provider's payout account could not be verified with the gateway, so this charge cannot be collected. Please try again later.");
    }
    if (live !== expectedPercent) {
      throw conflict("This provider's payout account is out of step with their commission rule, so this charge cannot be collected yet. Please try again later.");
    }
  }
}

/**
 * The commission split for a charge, resolved on the server at checkout time. Subscription payments
 * are platform-owned (no split). A provider's charge is always settled through the provider's
 * gateway subaccount — Medic1905's commission is taken at the gateway (the subaccount's
 * percentage for PERCENT rules, a flat transaction_charge for FIXED rules) so the provider's
 * share never passes through the platform account. Both the split and the subaccount are
 * snapshotted on the payment so later rule changes never rewrite history.
 */
async function resolveSplitForPayment(payment: Payment): Promise<PaymentSplit> {
  if (payment.kind === "SUBSCRIPTION") return noSplit;

  const payee = await prisma.user.findUnique({
    where: { id: payment.payeeId },
    select: {
      accountType: true,
      doctorProfile: { select: { id: true } },
      labStaffProfile: { select: { id: true } },
    },
  });
  if (!payee) return noSplit;

  const providerType = payee.doctorProfile
    ? ("DOCTOR" as const)
    : providerTypeForAccountType(payee.accountType);
  if (!providerType) return noSplit;

  const facilityId = payee.labStaffProfile?.id ?? null;
  const [subaccount, split] = await Promise.all([
    activeSubaccountForUser(payment.payeeId),
    resolveCommission(providerType, Number(payment.amount), prisma, facilityId),
  ]);

  // A provider's charge is settled through their payout subaccount or not at all: without it the
  // gateway has nowhere to send the provider's share, and collecting it into the platform
  // account would quietly break the split. Fail clearly instead.
  if (!subaccount) {
    throw conflict("This provider's payout account is not set up yet, so their charges cannot be collected yet. The provider can add payout details from their profile.");
  }

  // The gateway's split must match the snapshot we are about to write: the subaccount's
  // percentage is the rule's percentage for PERCENT rules, and zero otherwise.
  const expectedPercent = split.kind === "PERCENT" ? split.percent ?? 0 : 0;
  await alignSubaccountWithRule(payment.payeeId, subaccount, expectedPercent);

  return {
    subaccountCode: subaccount.subaccountCode,
    commissionAmount: split.commission,
    providerAmount: split.provider,
    commissionKind: split.kind,
    isProviderCharge: true,
  };
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
      await queueNotification(payment.payerId, { kind: "PAYMENT_FAILED", paymentId: payment.id });
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
      // Remember which charge actually succeeded; retries use fresh references.
      chargedReference: reference,
      receiptNumber: payment.receiptNumber ?? newReceiptNumber(),
    },
  });
  if (claimed.count === 0) {
    // The payment was already settled by another attempt. The snapshot this call read may be
    // stale after a concurrent outcome landed first, so re-read before deciding anything.
    const fresh = (await prisma.payment.findUnique({ where: { id: payment.id } })) ?? payment;
    // A *different* charge that also went through (a retry that succeeded twice, or arrived after
    // the payment itself was refunded) is a duplicate: give that money straight back, without
    // touching the payment's own status. Legacy payments (no chargedReference) can never be
    // classified as duplicates — their success is their own.
    if (
      (fresh.status === "SUCCESSFUL" || fresh.status === "REFUND_PENDING" || fresh.status === "REFUNDED") &&
      fresh.chargedReference &&
      reference !== fresh.chargedReference
    ) {
      await refundDuplicateCharge(fresh, reference);
    }
    // Re-run the post-payment work: these hooks are exactly-once, so a replay after a crash
    // simply completes whatever never finished.
    await runPostPaymentHooks(fresh).catch((error) =>
      console.error(`Payment ${payment.id}: post-payment recovery failed:`, error),
    );
    return fresh; // already settled by another call
  }

  await recordEvent(prisma, payment.id, "SUCCEEDED", { reference });

  await runPostPaymentHooks(payment).catch((error) =>
    console.error(`Payment ${payment.id}: post-payment hooks failed (the recovery job will retry):`, error),
  );

  if (lateAfterCancel) {
    // The booking was released while the payment was in flight. Give the money straight back.
    await requestRefund(payment.id, "Payment completed after the booking was released");
  } else {
    await queueNotification(payment.payerId, { kind: "PAYMENT_SUCCESSFUL", paymentId: payment.id });
    // The provider hears about the booking only once it is paid.
    if (payment.appointmentId) await queueNotification(payment.payeeId, { kind: "APPOINTMENT_REQUESTED", appointmentId: payment.appointmentId });
    if (payment.facilityBookingId) await queueNotification(payment.payeeId, { kind: "FACILITY_BOOKING_REQUESTED", bookingId: payment.facilityBookingId });
  }
  return prisma.payment.findUnique({ where: { id: payment.id } });
}

/**
 * The work that must happen once a payment is SUCCESSFUL. Both hooks are exactly-once (the
 * subscription activation consumes the payment under a unique constraint; the usage increment
 * is guarded by a marker event), so this is safe to run again on a webhook replay or by the
 * recovery job after a crash.
 */
async function runPostPaymentHooks(payment: Payment): Promise<void> {
  // A paid subscription charge activates (or renews) the doctor's plan.
  if (payment.kind === "SUBSCRIPTION") {
    await activateSubscriptionForPayment(payment.id);
  }

  // Consultation usage counts against the doctor's monthly allowance.
  if (payment.kind === "CONSULTATION" && payment.appointmentId) {
    await recordConsultationUsage(payment.payeeId, payment.id);
  }
}

/**
 * Return a duplicate charge (a retry that succeeded after another attempt already settled the
 * payment, or a success that landed after the payment itself was refunded). Exactly-once per
 * gateway reference: the submission is claimed FIRST by inserting a uniquely-keyed event row —
 * concurrent replays of the same callback collide on the unique key and stop — and the claim is
 * released again if the gateway rejects the call, so a later replay can retry. The payment's own
 * status and refund records are never touched by it.
 */
async function refundDuplicateCharge(payment: Payment, reference: string): Promise<void> {
  const dedupeKey = `duplicate-refund:${reference}`;
  try {
    // Claim before the external call: a crash after the gateway accepts but before we record
    // anything still leaves this claim behind, so no replay can submit a second refund.
    await prisma.paymentEvent.create({
      data: { paymentId: payment.id, type: "DUPLICATE_CHARGE_REFUND_SUBMITTED", details: { reference }, dedupeKey },
    });
  } catch (error) {
    // The unique key already exists: this reference's refund is claimed (submitted or being
    // submitted) by another call. Nothing to do.
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") return;
    throw error;
  }
  try {
    const result = await getPaymentProvider().refund(reference);
    // "processed" is the mock provider's immediate answer; the real gateway confirms via webhook.
    if (result.status === "processed") {
      await recordEvent(prisma, payment.id, "DUPLICATE_CHARGE_REFUNDED", { reference });
    }
  } catch (error) {
    // Release the claim so a later replay can retry, and keep the failure visible.
    await prisma.paymentEvent.deleteMany({ where: { paymentId: payment.id, dedupeKey } }).catch(() => {});
    await recordEvent(prisma, payment.id, "DUPLICATE_CHARGE_REFUND_FAILED", { reference });
    console.error(`Duplicate charge ${reference} for payment ${payment.id} could not be refunded:`, error);
  }
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
  // Refund events only ever concern the payment's own charge. A refund of a *different* reference
  // is a duplicate charge being returned, which must not change the payment's refund state.
  const concernsThisCharge = !payment.chargedReference || event.reference === payment.chargedReference;
  if (event.type === "refund.processed") {
    if (concernsThisCharge) {
      await markRefunded(payment.id);
    } else {
      await recordEvent(prisma, payment.id, "DUPLICATE_CHARGE_REFUNDED", { reference: event.reference });
    }
  } else if (event.type === "refund.pending") {
    if (concernsThisCharge) {
      await prisma.refund.updateMany({ where: { paymentId: payment.id, status: "APPROVED" }, data: { status: "PROCESSING" } });
    }
    await recordEvent(prisma, payment.id, "REFUND_PENDING", { reference: event.reference });
  } else if (event.type === "refund.failed") {
    if (concernsThisCharge) {
      await prisma.refund.updateMany({ where: { paymentId: payment.id, status: { in: ["APPROVED", "PROCESSING"] } }, data: { status: "FAILED", failureReason: "The gateway could not process the refund" } });
    }
    await recordEvent(prisma, payment.id, "REFUND_FAILED", { reference: event.reference });
  } else {
    await recordEvent(prisma, payment.id, String(event.type).toUpperCase().replace(".", "_"), { reference: event.reference });
  }
}

/** Begin refunding a successful payment in full. Safe to call twice. */
export async function requestRefund(paymentId: string, reason: string): Promise<void> {
  const claimed = await prisma.payment.updateMany({ where: { id: paymentId, status: "SUCCESSFUL" }, data: { status: "REFUND_PENDING" } });
  if (claimed.count === 0) return;
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await recordEvent(prisma, paymentId, "REFUND_REQUESTED", { reason });
  // Policy-eligible cancellations and admin approvals land here directly: record them as approved.
  await prisma.refund.upsert({
    where: { paymentId },
    create: {
      paymentId,
      requestedById: payment.payeeId,
      reason,
      status: "APPROVED",
      amount: payment.amount,
      currency: payment.currency,
      autoApproved: true,
      decidedAt: new Date(),
    },
    update: { status: "APPROVED", decidedAt: new Date(), failureReason: null },
  });
  queueNotification(payment.payerId, { kind: "PAYMENT_REFUND_PENDING", paymentId });
  await submitRefund(payment);
}

/** A patient asks for their money back. The request waits for an admin decision. */
export async function requestRefundApproval(paymentId: string, requestedById: string, reason: string): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, payerId: requestedById, status: "SUCCESSFUL" },
  });
  if (!payment) throw notFound("No refundable payment found");

  const existing = await prisma.refund.findUnique({ where: { paymentId } });
  if (existing && existing.status !== "REJECTED" && existing.status !== "FAILED") {
    throw conflict("A refund request already exists for this payment");
  }

  await prisma.refund.upsert({
    where: { paymentId },
    create: {
      paymentId,
      requestedById,
      reason,
      status: "PENDING",
      amount: payment.amount,
      currency: payment.currency,
    },
    update: { status: "PENDING", reason, requestedById, failureReason: null },
  });
  await recordEvent(prisma, paymentId, "REFUND_REQUEST_SUBMITTED", { reason });
  queueNotification(requestedById, { kind: "REFUND_REQUESTED", paymentId });
  queueAdminAlert({ kind: "REFUND_REQUESTED", paymentId });
}

/** An admin approves or rejects a pending refund request. A FAILED submission can be re-approved. */
export async function decideRefund(refundId: string, adminId: string, approve: boolean, note?: string): Promise<void> {
  const refund = await prisma.refund.findUnique({ where: { id: refundId }, include: { payment: true } });
  if (!refund) throw notFound("Refund request not found");
  if (refund.status !== "PENDING" && refund.status !== "FAILED") {
    throw conflict("This refund request has already been decided");
  }

  if (!approve) {
    // Conditional transition: two admins deciding at once cannot both apply.
    const claimed = await prisma.refund.updateMany({
      where: { id: refundId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "REJECTED", decidedById: adminId, decidedAt: new Date(), failureReason: note ?? null },
    });
    if (claimed.count === 0) throw conflict("This refund request has already been decided");
    await recordEvent(prisma, refund.paymentId, "REFUND_REJECTED", { note });
    queueNotification(refund.payment.payerId, { kind: "REFUND_DECIDED", paymentId: refund.paymentId, approved: false });
    return;
  }

  const claimed = await prisma.refund.updateMany({
    where: { id: refundId, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "APPROVED",
      decidedById: adminId,
      decidedAt: new Date(),
      failureReason: null,
      ...(note ? { reason: `${refund.reason} — ${note}` } : {}),
    },
  });
  if (claimed.count === 0) throw conflict("This refund request has already been decided");
  await requestRefund(refund.paymentId, note ?? refund.reason);
}

/** Send the refund request to the gateway. Failures are recorded and retried by the scheduled job. */
export async function submitRefund(payment: Payment): Promise<void> {
  try {
    // Refund the charge that actually succeeded, not whichever reference was assigned last.
    const result = await getPaymentProvider().refund(payment.chargedReference ?? payment.providerReference);
    await recordEvent(prisma, payment.id, "REFUND_ACCEPTED", { gatewayStatus: result.status });
    if (result.status === "processed") await markRefunded(payment.id);
  } catch (error) {
    console.error(`Refund request for payment ${payment.id} failed:`, error);
    await recordEvent(prisma, payment.id, "REFUND_REQUEST_FAILED", {});
  }
}

/**
 * Retry the refund work that never completed. Covers every crash window: a refund approved but
 * never submitted (the payment is still SUCCESSFUL), one submitted but unconfirmed by the
 * gateway, and a payment moved to refund processing whose refund record never landed.
 */
export async function processRefundQueue(): Promise<number> {
  let handled = 0;

  // Approved refunds whose payment never entered refund processing.
  const approved = await prisma.refund.findMany({
    where: { status: "APPROVED", payment: { status: "SUCCESSFUL" } },
    take: 50,
  });
  for (const refund of approved) {
    await requestRefund(refund.paymentId, refund.reason);
    handled += 1;
  }

  // Refunds approved and submitted but never completed by the gateway. Re-submission is skipped
  // when the gateway already accepted one (it would only reject the duplicate call).
  const processing = await prisma.payment.findMany({
    where: { status: "REFUND_PENDING" },
    include: { refund: true },
    take: 50,
  });
  for (const payment of processing) {
    const accepted = await prisma.paymentEvent.findFirst({
      where: { paymentId: payment.id, type: "REFUND_ACCEPTED" },
      select: { id: true, createdAt: true },
    });
    if (!payment.refund && !accepted) {
      // The refund record never landed (a crash between the status change and the upsert).
      await prisma.refund.create({
        data: {
          paymentId: payment.id,
          requestedById: payment.payeeId,
          reason: "Recovering an interrupted refund",
          status: "APPROVED",
          amount: payment.amount,
          currency: payment.currency,
          autoApproved: true,
          decidedAt: new Date(),
        },
      }).catch(() => {}); // another recovery run got there first
    }
    if (!accepted) {
      await submitRefund(payment);
      handled += 1;
    } else if (Date.now() - accepted.createdAt.getTime() > 24 * 3_600_000) {
      // The gateway accepted the refund more than a day ago but it never completed (no
      // refund.processed webhook, or it failed). Re-submitting would be rejected, so this needs
      // a human: alert the admins to check the refund's status in the gateway dashboard.
      await recordEvent(prisma, payment.id, "REFUND_STUCK", {});
      queueAdminAlert({ kind: "REFUND_STUCK", paymentId: payment.id });
    }
  }

  return handled;
}

/**
 * Recovery for the late-cancellation refund: a payment that succeeded after its booking was
 * released must be refunded. The obligation is derived from durable state: the booking's
 * cancellation (its last update) happened BEFORE the money arrived, so the normal cancellation
 * flow could not have applied its policy decision to this payment — the late-arrival refund
 * was owed and, if the process died before submitting it, this daily pass finds it. A payment
 * that was already successful when the booking was cancelled is deliberately left alone: the
 * cancellation flow already applied the refund policy to it (refund when eligible, kept when
 * not — a non-refundable late patient cancellation stays paid).
 */
export async function recoverLateCancellationRefunds(lookbackDays = 7): Promise<number> {
  const since = new Date(Date.now() - lookbackDays * 86_400_000);
  const payments = await prisma.payment.findMany({
    where: {
      status: "SUCCESSFUL",
      kind: { in: ["CONSULTATION", "FACILITY_SERVICE"] },
      createdAt: { gte: since },
    },
    include: {
      refund: { select: { id: true } },
      events: { where: { type: { in: ["REFUND_REQUESTED", "REFUND_STUCK"] } }, select: { id: true } },
    },
    take: 200,
  });
  let recovered = 0;
  for (const payment of payments) {
    if (payment.refund || payment.events.length > 0) continue;
    const paidAt = payment.paidAt ?? payment.createdAt;
    const bookingCancelledBeforePayment =
      (payment.appointmentId !== null && (await isAppointmentCancelledBefore(payment.appointmentId, paidAt))) ||
      (payment.facilityBookingId !== null && (await isFacilityBookingCancelledBefore(payment.facilityBookingId, paidAt)));
    if (!bookingCancelledBeforePayment) continue;
    await requestRefund(payment.id, "Payment completed after the booking was released");
    recovered += 1;
  }
  return recovered;
}

async function isAppointmentCancelledBefore(appointmentId: string, paidAt: Date): Promise<boolean> {
  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { status: true, updatedAt: true } });
  return appointment?.status === "CANCELLED" && appointment.updatedAt < paidAt;
}

async function isFacilityBookingCancelledBefore(bookingId: string, paidAt: Date): Promise<boolean> {
  const booking = await prisma.facilityBooking.findUnique({ where: { id: bookingId }, select: { status: true, updatedAt: true } });
  return booking?.status === "CANCELLED" && booking.updatedAt < paidAt;
}

export async function markRefunded(paymentId: string): Promise<void> {
  // Payment status and refund records move in one transaction: a crash can never leave the
  // payment REFUNDED while its refund record still waits, or the reverse.
  const claimed = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: "REFUND_PENDING" },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
    if (claimed.count === 0) return 0;
    await tx.refund.updateMany({
      // FAILED is included: a refund.processed webhook can legitimately follow a refund.failed
      // one (the gateway retried), and the record must end PROCESSED with the payment.
      where: { paymentId, status: { in: ["APPROVED", "PROCESSING", "FAILED"] } },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    return claimed.count;
  });
  if (claimed === 0) return;
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { payerId: true } });
  await recordEvent(prisma, paymentId, "REFUNDED");
  await queueNotification(payment.payerId, { kind: "PAYMENT_REFUNDED", paymentId });
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
      // An unpaid subscription charge means the plan was never started (or the renewal never happened).
      if (payment.kind === "SUBSCRIPTION") await markSubscriptionPaymentExpired(tx, payment.id);
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
