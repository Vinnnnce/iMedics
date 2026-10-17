import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { toMinorUnits } from "./money";
import { getPaymentProvider } from "./payments/provider";
import type { GatewayTransaction } from "./payments/provider";
import { applyProviderOutcome, findPaymentByReference } from "./payments/service";
import { queueAdminAlert } from "./notifications/service";

export interface LocalPaymentRow {
  id: string;
  providerReference: string;
  amountMinor: number;
  currency: string;
  status: string;
  appointmentId: string | null;
  facilityBookingId: string | null;
}

export interface DiscrepancyDraft {
  type: "MISSING_WEBHOOK" | "AMOUNT_MISMATCH" | "DUPLICATE_PAYMENT" | "FAILED_SETTLEMENT" | "ORPHANED_GATEWAY_RECORD";
  severity: "INFO" | "WARNING" | "CRITICAL";
  paymentId?: string;
  providerReference?: string;
  expected?: Record<string, unknown>;
  actual?: Record<string, unknown>;
}

export interface ReconciliationResult {
  runId: string;
  date: string;
  localCount: number;
  localAmountMinor: number;
  gatewayCount: number;
  gatewayAmountMinor: number;
  discrepancies: number;
  selfHealed: number;
}

/**
 * Compare our payment records with the gateway's transactions for a UTC day. Pure: the same
 * inputs always produce the same discrepancy list, which keeps it easy to test.
 */
export function diffReconciliation(
  local: LocalPaymentRow[],
  gateway: GatewayTransaction[],
  resolveLocal: (reference: string) => LocalPaymentRow | null,
): DiscrepancyDraft[] {
  const drafts: DiscrepancyDraft[] = [];
  const byReference = new Map(local.map((p) => [p.providerReference, p]));
  const seenGatewayRefs = new Set<string>();

  // 1. Gateway transactions we cannot account for, and local payments the gateway does not know.
  for (const tx of gateway) {
    seenGatewayRefs.add(tx.reference);
    const localPayment = byReference.get(tx.reference) ?? resolveLocal(tx.reference);

    if (!localPayment) {
      drafts.push({
        type: "ORPHANED_GATEWAY_RECORD",
        severity: "CRITICAL",
        providerReference: tx.reference,
        expected: { localPayment: "exists" },
        actual: { localPayment: "missing", amountMinor: tx.amountMinor, currency: tx.currency },
      });
      continue;
    }

    if (tx.status === "success" && (localPayment.status === "PENDING" || localPayment.status === "FAILED")) {
      // The money moved but our record never heard about it: a webhook went missing.
      drafts.push({
        type: "MISSING_WEBHOOK",
        severity: "CRITICAL",
        paymentId: localPayment.id,
        providerReference: tx.reference,
        expected: { status: "SUCCESSFUL", amountMinor: tx.amountMinor },
        actual: { status: localPayment.status, amountMinor: localPayment.amountMinor },
      });
      continue;
    }

    if (localPayment.status === "SUCCESSFUL" && tx.status === "success" && tx.amountMinor !== localPayment.amountMinor) {
      drafts.push({
        type: "AMOUNT_MISMATCH",
        severity: "CRITICAL",
        paymentId: localPayment.id,
        providerReference: tx.reference,
        expected: { amountMinor: localPayment.amountMinor },
        actual: { amountMinor: tx.amountMinor },
      });
    }
  }

  // A payment counts as present in the gateway report when one of its charge attempts appears
  // there as a *successful* charge in the same currency — only a success that moved money can
  // vouch for a payment we believe succeeded (a failed attempt cannot).
  const matchedPaymentIds = new Set<string>();
  for (const tx of gateway) {
    if (tx.status !== "success") continue;
    const localPayment = byReference.get(tx.reference) ?? resolveLocal(tx.reference);
    if (localPayment && localPayment.currency === tx.currency) matchedPaymentIds.add(localPayment.id);
  }

  for (const payment of local) {
    if (payment.status !== "SUCCESSFUL") continue;
    // Only a validated successful match can vouch: a failed or foreign-currency row under the
    // payment's current reference must not suppress the warning.
    const gatewayHasIt = matchedPaymentIds.has(payment.id);
    if (gatewayHasIt) continue;
    // The gateway's charge report has no record of a payment we believe succeeded. The charge list
    // is not a settlement report, so this needs a human to verify in the gateway dashboard.
    drafts.push({
      type: "FAILED_SETTLEMENT",
      severity: "WARNING",
      paymentId: payment.id,
      providerReference: payment.providerReference,
      expected: { gatewayRecord: "exists", amountMinor: payment.amountMinor },
      actual: { gatewayRecord: "missing" },
    });
  }

  // 2. More than one successful charge for the same booking.
  const byBooking = new Map<string, LocalPaymentRow[]>();
  for (const payment of local) {
    if (payment.status !== "SUCCESSFUL") continue;
    const key = payment.appointmentId ?? payment.facilityBookingId ?? null;
    if (!key) continue;
    byBooking.set(key, [...(byBooking.get(key) ?? []), payment]);
  }
  for (const [bookingId, payments] of byBooking) {
    if (payments.length > 1) {
      drafts.push({
        type: "DUPLICATE_PAYMENT",
        severity: "WARNING",
        paymentId: payments[0].id,
        providerReference: payments.map((p) => p.providerReference).join(", "),
        expected: { successfulCharges: 1, bookingId },
        actual: { successfulCharges: payments.length, paymentIds: payments.map((p) => p.id) },
      });
    }
  }

  return drafts;
}

/**
 * The daily reconciliation: pull the gateway's transactions for a UTC day, compare them with our
 * payment records, persist every difference, and alert the admins. A missing webhook is also
 * self-healed immediately by asking the gateway for the truth and applying it.
 */
export async function runDailyReconciliation(date = new Date(), db: PrismaClient = prisma): Promise<ReconciliationResult> {
  const provider = getPaymentProvider();
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const run = await db.reconciliationRun.upsert({
    where: { date_provider: { date: dayStart, provider: provider.name } },
    create: { date: dayStart, provider: provider.name, status: "PENDING" },
    update: { status: "PENDING", startedAt: new Date(), finishedAt: null },
  });
  // A re-run replaces the previous findings.
  await db.reconciliationDiscrepancy.deleteMany({ where: { runId: run.id } });

  const localRows = await db.payment.findMany({
    where: { provider: provider.name, createdAt: { gte: dayStart, lt: dayEnd } },
    select: {
      id: true,
      providerReference: true,
      amount: true,
      currency: true,
      status: true,
      appointmentId: true,
      facilityBookingId: true,
    },
    take: 2_000,
  });
  const local: LocalPaymentRow[] = localRows.map((p) => ({
    id: p.id,
    providerReference: p.providerReference,
    amountMinor: toMinorUnits(p.amount.toString()),
    currency: p.currency,
    status: p.status,
    appointmentId: p.appointmentId,
    facilityBookingId: p.facilityBookingId,
  }));

  let gateway: GatewayTransaction[] = [];
  if (provider.listTransactions) {
    try {
      gateway = await provider.listTransactions({ from: dayStart, to: dayEnd });
    } catch (error) {
      console.error("Reconciliation could not read the gateway report:", error);
      await db.reconciliationRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date() } });
      throw error;
    }
  }

  // A retry may have succeeded under a fresh reference: resolve earlier attempts too, so gateway
  // records are matched against the payment they belong to and not just its latest reference.
  const byAnyReference = new Map(local.map((p) => [p.providerReference, p]));
  for (const tx of gateway) {
    if (byAnyReference.has(tx.reference)) continue;
    const payment = await findPaymentByReference(tx.reference);
    if (payment) {
      byAnyReference.set(tx.reference, {
        id: payment.id,
        providerReference: payment.providerReference,
        amountMinor: toMinorUnits(payment.amount.toString()),
        currency: payment.currency,
        status: payment.status,
        appointmentId: payment.appointmentId,
        facilityBookingId: payment.facilityBookingId,
      });
    }
  }

  const drafts = diffReconciliation(local, gateway, (reference) => byAnyReference.get(reference) ?? null);

  // Self-heal missing webhooks: re-verify against the gateway and apply the outcome.
  let selfHealed = 0;
  for (const draft of drafts) {
    if (draft.type !== "MISSING_WEBHOOK" || !draft.providerReference) continue;
    try {
      const verified = await getPaymentProvider().verify(draft.providerReference);
      if (verified.status === "success") {
        await applyProviderOutcome(draft.providerReference, {
          status: "success",
          amountMinor: verified.amountMinor,
          currency: verified.currency,
          channel: verified.channel,
        });
        selfHealed += 1;
      }
    } catch (error) {
      console.error(`Reconciliation could not self-heal ${draft.providerReference}:`, error);
    }
  }

  await db.reconciliationDiscrepancy.createMany({
    data: drafts.map((draft) => ({
      runId: run.id,
      type: draft.type,
      severity: draft.severity,
      paymentId: draft.paymentId ?? null,
      providerReference: draft.providerReference ?? null,
      expected: (draft.expected ?? {}) as Prisma.InputJsonValue,
      actual: (draft.actual ?? {}) as Prisma.InputJsonValue,
    })),
  });

  const gatewayAmountMinor = gateway.reduce((sum, tx) => sum + tx.amountMinor, 0);
  const localAmountMinor = local.reduce((sum, p) => sum + p.amountMinor, 0);
  const completed = await db.reconciliationRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      localCount: local.length,
      localAmountMinor: localAmountMinor,
      gatewayCount: gateway.length,
      gatewayAmountMinor: gatewayAmountMinor,
      finishedAt: new Date(),
    },
  });

  if (drafts.length > 0) {
    queueAdminAlert({ kind: "RECONCILIATION_ALERT", runId: run.id, discrepancies: drafts.length });
  }

  return {
    runId: completed.id,
    date: dayStart.toISOString().slice(0, 10),
    localCount: local.length,
    localAmountMinor,
    gatewayCount: gateway.length,
    gatewayAmountMinor,
    discrepancies: drafts.length,
    selfHealed,
  };
}

/** The most recent reconciliation runs with their unresolved findings, for the admin screen. */
export async function recentRuns(limit = 14) {
  const runs = await prisma.reconciliationRun.findMany({
    orderBy: [{ date: "desc" }],
    take: limit,
    include: { discrepancies: { where: { resolvedAt: null } } },
  });
  return runs.map((run) => ({
    id: run.id,
    date: run.date.toISOString().slice(0, 10),
    provider: run.provider,
    status: run.status,
    localCount: run.localCount,
    gatewayCount: run.gatewayCount,
    localAmountMinor: Number(run.localAmountMinor),
    gatewayAmountMinor: Number(run.gatewayAmountMinor),
    openDiscrepancies: run.discrepancies.length,
  }));
}
