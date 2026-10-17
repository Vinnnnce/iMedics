import type { Prisma, SubscriptionPlan, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { badRequest, conflict, forbidden, notFound } from "./errors";
import { queueNotification } from "./notifications/service";
import { newReference, holdExpiry } from "./payments/refs";
import { getPaymentProvider } from "./payments/provider";
import { round2 } from "./commissions";

type Db = PrismaClient | Prisma.TransactionClient;

/** The features a subscription tier can switch on. Everything else is always available. */
export const SUBSCRIPTION_FEATURES = ["chat", "audio", "video", "ai", "analytics", "listing"] as const;
export type SubscriptionFeature = (typeof SUBSCRIPTION_FEATURES)[number];

const FEATURE_LABELS: Record<SubscriptionFeature, string> = {
  chat: "patient chat",
  audio: "audio consultations",
  video: "video consultations",
  ai: "AI tools",
  analytics: "analytics",
  listing: "directory listing",
};

/**
 * What a doctor without an active subscription can do. Chat with existing patients and a basic
 * directory listing stay free; audio, video, AI tools and analytics require a plan.
 */
export const FREE_ENTITLEMENTS: Record<SubscriptionFeature, boolean> = {
  chat: true,
  audio: false,
  video: false,
  ai: false,
  analytics: false,
  listing: true,
};

export type Entitlements = Record<SubscriptionFeature, boolean>;

/** A plan's entitlement map: FREE defaults, switched on by the plan's `features` JSON. */
export function entitlementsForPlan(plan: Pick<SubscriptionPlan, "features">): Entitlements {
  const features = (plan.features ?? {}) as Record<string, unknown>;
  const merged: Entitlements = { ...FREE_ENTITLEMENTS };
  // Only keys the plan sets explicitly override the free baseline.
  for (const feature of SUBSCRIPTION_FEATURES) {
    if (feature in features) merged[feature] = Boolean(features[feature]);
  }
  return merged;
}

/** The doctor's current entitlements, resolved from their active subscription (or the free tier). */
export async function getEntitlements(userId: string, db: Db = prisma): Promise<Entitlements> {
  const subscription = await db.doctorSubscription.findFirst({
    where: { doctor: { userId }, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    include: { plan: true },
  });
  return subscription ? entitlementsForPlan(subscription.plan) : { ...FREE_ENTITLEMENTS };
}

/** Throws when the doctor's plan does not include a feature. Server-side only: never trust the client. */
export async function requireEntitlement(userId: string, feature: SubscriptionFeature): Promise<void> {
  const entitlements = await getEntitlements(userId);
  if (!entitlements[feature]) {
    throw forbidden(`Your plan does not include ${FEATURE_LABELS[feature]}. Upgrade your subscription to unlock it.`);
  }
}

export async function hasEntitlement(userId: string, feature: SubscriptionFeature): Promise<boolean> {
  return (await getEntitlements(userId))[feature];
}

/** Plans a doctor can pick, cheapest first. */
export async function listPlans(db: Db = prisma): Promise<SubscriptionPlan[]> {
  return db.subscriptionPlan.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

/** The doctor's subscription with its plan, or null. */
export async function getDoctorSubscription(userId: string, db: Db = prisma) {
  return db.doctorSubscription.findFirst({
    where: { doctor: { userId } },
    include: { plan: true, payment: { select: { id: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export interface Purchase {
  subscriptionId: string;
  paymentId: string;
  /** True when an active subscription is being upgraded or downgraded rather than started. */
  isChange: boolean;
}

/**
 * Prepare a plan purchase: the charge is created first and the doctor's current plan is left
 * untouched. The new plan is only applied when the verified payment succeeds (see
 * `activateSubscriptionForPayment`). The doctor pays the platform (the first active admin
 * account is the platform payee).
 */
export async function prepareSubscriptionPurchase(userId: string, planCode: string, db: Db = prisma): Promise<Purchase> {
  const doctor = await db.doctorProfile.findFirst({ where: { userId } });
  if (!doctor) throw badRequest("Only doctors can subscribe to a plan");

  const plan = await db.subscriptionPlan.findFirst({ where: { code: planCode, active: true } });
  if (!plan) throw notFound("Plan not found");

  // Seeded plan prices are placeholder defaults. Purchases stay disabled until an admin has
  // reviewed and confirmed them (set `pricingConfirmed: true` on the plan), so nobody can be
  // billed at an invented price.
  const features = (plan.features ?? {}) as Record<string, unknown>;
  if (features.pricingConfirmed !== true) {
    throw conflict("This plan's pricing has not been confirmed yet, so purchases are temporarily disabled.");
  }

  const platform = await db.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  if (!platform) throw conflict("The platform account is not configured yet. Please try again later.");

  const now = new Date();

  return db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        kind: "SUBSCRIPTION",
        payerId: userId,
        payeeId: platform.id,
        description: `Subscription: ${plan.name}`,
        amount: plan.monthlyPrice,
        currency: plan.currency,
        provider: getPaymentProvider().name,
        providerReference: newReference(),
        expiresAt: holdExpiry(),
        events: { create: { type: "CREATED", details: { planCode: plan.code } } },
      },
    });

    const existing = await tx.doctorSubscription.findUnique({ where: { doctorId: doctor.id } });
    if (!existing) {
      const subscription = await tx.doctorSubscription.create({
        data: {
          doctorId: doctor.id,
          planId: plan.id,
          status: "PENDING_PAYMENT",
          // The real period is set when the payment succeeds.
          currentPeriodStart: now,
          currentPeriodEnd: now,
          paymentId: payment.id,
        },
      });
      return { subscriptionId: subscription.id, paymentId: payment.id, isChange: false };
    }

    if (existing.status === "PENDING_PAYMENT") {
      // An earlier unpaid purchase is superseded by this one.
      await tx.doctorSubscription.update({
        where: { id: existing.id },
        data: { planId: plan.id, paymentId: payment.id, currentPeriodStart: now, currentPeriodEnd: now },
      });
      return { subscriptionId: existing.id, paymentId: payment.id, isChange: true };
    }

    // ACTIVE, CANCELLED or EXPIRED: the current plan and period stay exactly as they are until
    // the new charge succeeds. The pending purchase travels with the payment (its CREATED event
    // records the target plan) and is applied by `activateSubscriptionForPayment`.
    return { subscriptionId: existing.id, paymentId: payment.id, isChange: true };
  });
}

/**
 * A subscription charge succeeded: apply the plan that was purchased. Called from the payment
 * pipeline (verified webhook or verification), never from the browser redirect.
 *
 * Exactly-once per charge, and serialized per doctor: the whole plan change runs in one
 * transaction under an advisory lock on the doctor's subscription, with the subscription's
 * current plan and period read *inside* that transaction — two concurrent renewals cannot
 * both extend from the same stale end date, and a webhook renewal cannot race the lifecycle
 * job's expiry pass. The consuming `SubscriptionEvent` (unique paymentId) is what makes each
 * payment apply exactly once no matter how often it replays.
 */
export async function activateSubscriptionForPayment(paymentId: string, db: Db = prisma): Promise<void> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { status: true, payerId: true, events: { where: { type: "CREATED" }, take: 1, orderBy: { createdAt: "asc" } } },
  });
  if (!payment || payment.status !== "SUCCESSFUL") return;

  const doctor = await db.doctorProfile.findFirst({ where: { userId: payment.payerId }, select: { id: true } });
  if (!doctor) return;

  const planCode = (payment.events[0]?.details as { planCode?: string } | undefined)?.planCode;
  const plan = planCode ? await db.subscriptionPlan.findFirst({ where: { code: planCode } }) : null;
  if (!plan) return;

  let activated: { subscriptionId: string; type: "STARTED" | "RENEWED" | "PLAN_CHANGED" } | null = null;
  try {
    activated = await db.$transaction(async (tx) => {
      // Serialize every plan change for this doctor against every other one.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"doctor-sub:" + doctor.id}))`;

      // Fast path inside the lock: this charge has already been applied.
      const consumed = await tx.subscriptionEvent.findFirst({ where: { paymentId }, select: { id: true } });
      if (consumed) return null;

      const subscription = await tx.doctorSubscription.findUnique({ where: { doctorId: doctor.id } });
      if (!subscription) return null;

      const now = new Date();
      const wasActive = subscription.status === "ACTIVE" && subscription.currentPeriodEnd > now;
      // A renewal of the same plan extends from the current period's end; anything else (first
      // purchase, reactivation after expiry, or a plan change) starts a fresh period now.
      const base = wasActive && subscription.planId === plan.id ? subscription.currentPeriodEnd : now;
      const type = wasActive ? (subscription.planId === plan.id ? "RENEWED" : "PLAN_CHANGED") : "STARTED";

      // Consuming the payment first, under the unique constraint, is what makes this exactly-once.
      await tx.subscriptionEvent.create({
        data: { subscriptionId: subscription.id, type, paymentId, details: { planCode: plan.code } },
      });
      await tx.doctorSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "ACTIVE",
          planId: plan.id,
          currentPeriodStart: now,
          currentPeriodEnd: addMonths(base, 1),
          consultationsUsed: 0,
          cancelAtPeriodEnd: false,
          paymentId,
        },
      });
      return { subscriptionId: subscription.id, type };
    });
  } catch (error) {
    // A unique violation is the exactly-once guard doing its job: another call consumed this
    // payment first. Anything else is a real failure and is surfaced.
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") return;
    throw error;
  }

  if (activated) {
    queueNotification(
      payment.payerId,
      activated.type === "RENEWED"
        ? { kind: "SUBSCRIPTION_RENEWED", subscriptionId: activated.subscriptionId }
        : activated.type === "PLAN_CHANGED"
          ? { kind: "PLAN_CHANGED", subscriptionId: activated.subscriptionId }
          : { kind: "SUBSCRIPTION_ACTIVATED", subscriptionId: activated.subscriptionId },
    );
  }
}

/**
 * Crash recovery for the managed renewal flow: a subscription charge that succeeded but whose
 * activation never completed (a webhook processed while the process died mid-way). Called by
 * the scheduled job; `activateSubscriptionForPayment` consumes each payment exactly once, so
 * re-running this on an already-applied charge is a no-op.
 */
export async function repairSubscriptionActivations(lookbackDays = 7): Promise<number> {
  const since = new Date(Date.now() - lookbackDays * 86_400_000);
  const payments = await prisma.payment.findMany({
    where: { kind: "SUBSCRIPTION", status: "SUCCESSFUL", paidAt: { gte: since } },
    select: { id: true },
    take: 100,
  });
  let repaired = 0;
  for (const payment of payments) {
    const applied = await prisma.subscriptionEvent.findFirst({ where: { paymentId: payment.id }, select: { id: true } });
    if (applied) continue;
    await activateSubscriptionForPayment(payment.id);
    const now = await prisma.subscriptionEvent.findFirst({ where: { paymentId: payment.id }, select: { id: true } });
    if (now) repaired += 1;
  }
  return repaired;
}

/** The subscription charge expired without being paid: the plan never started. */
export async function markSubscriptionPaymentExpired(db: Db, paymentId: string): Promise<void> {
  const subscription = await db.doctorSubscription.findFirst({
    where: { paymentId, status: "PENDING_PAYMENT" },
    select: { id: true },
  });
  if (!subscription) return;
  await db.doctorSubscription.update({ where: { id: subscription.id }, data: { status: "EXPIRED" } });
  await db.subscriptionEvent.create({ data: { subscriptionId: subscription.id, type: "EXPIRED", details: { paymentId } } });
}

/** A paid consultation counts against the doctor's monthly allowance (null allowance = unlimited). */
export async function recordConsultationUsage(payeeUserId: string, paymentId: string, db: Db = prisma): Promise<void> {
  const doctor = await db.doctorProfile.findFirst({ where: { userId: payeeUserId }, select: { id: true } });
  if (!doctor) return;
  // Exactly-once: the increment and its marker event are one transaction, serialized by an
  // advisory lock on the payment, so webhook replays and the recovery path cannot double-count.
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${paymentId}))`;
    const already = await tx.paymentEvent.findFirst({
      where: { paymentId, type: "CONSULTATION_USAGE_RECORDED" },
      select: { id: true },
    });
    if (already) return;
    await tx.doctorSubscription.updateMany({
      where: { doctorId: doctor.id, status: "ACTIVE" },
      data: { consultationsUsed: { increment: 1 } },
    });
    await tx.paymentEvent.create({ data: { paymentId, type: "CONSULTATION_USAGE_RECORDED", details: {} } });
  });
}

/**
 * Crash recovery for consultation usage: paid consultations whose allowance increment never
 * landed (the webhook died between committing the success and running the hook). Each payment's
 * increment is exactly-once, so re-running this is safe.
 */
export async function repairConsultationUsage(lookbackDays = 7): Promise<number> {
  const since = new Date(Date.now() - lookbackDays * 86_400_000);
  const payments = await prisma.payment.findMany({
    where: { kind: "CONSULTATION", status: "SUCCESSFUL", appointmentId: { not: null }, paidAt: { gte: since } },
    select: { id: true, payeeId: true, events: { where: { type: "CONSULTATION_USAGE_RECORDED" }, select: { id: true } } },
    take: 100,
  });
  let repaired = 0;
  for (const payment of payments) {
    if (payment.events.length > 0) continue;
    try {
      await recordConsultationUsage(payment.payeeId, payment.id);
      repaired += 1;
    } catch (error) {
      console.error(`Could not repair consultation usage for payment ${payment.id}:`, error);
    }
  }
  return repaired;
}

/** Whether the doctor has used up their monthly consultation allowance. */
export async function allowanceExhausted(payeeUserId: string, db: Db = prisma): Promise<boolean> {
  const doctor = await db.doctorProfile.findFirst({ where: { userId: payeeUserId }, select: { id: true } });
  if (!doctor) return false;
  const subscription = await db.doctorSubscription.findFirst({
    where: { doctorId: doctor.id, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    include: { plan: true },
  });
  if (!subscription || subscription.plan.consultationAllowance === null) return false;
  return subscription.consultationsUsed >= subscription.plan.consultationAllowance;
}

/** The doctor asks for the plan not to renew. They keep access until the period ends. */
export async function cancelAtPeriodEnd(userId: string, db: Db = prisma): Promise<void> {
  const subscription = await db.doctorSubscription.findFirst({
    where: { doctor: { userId }, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) throw notFound("No active subscription found");
  if (subscription.cancelAtPeriodEnd) return;
  await db.doctorSubscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: true } });
  await db.subscriptionEvent.create({ data: { subscriptionId: subscription.id, type: "CANCEL_REQUESTED", details: {} } });
  queueNotification(userId, { kind: "SUBSCRIPTION_CANCELLED", subscriptionId: subscription.id });
}

/** Undo a pending cancellation (the plan renews as normal). */
export async function resumeSubscription(userId: string, db: Db = prisma): Promise<void> {
  const subscription = await db.doctorSubscription.findFirst({
    where: { doctor: { userId }, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription) throw notFound("No active subscription found");
  if (!subscription.cancelAtPeriodEnd) return;
  await db.doctorSubscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: false } });
  await db.subscriptionEvent.create({ data: { subscriptionId: subscription.id, type: "RESUMED", details: {} } });
  queueNotification(userId, { kind: "SUBSCRIPTION_RENEWAL_DUE", subscriptionId: subscription.id });
}

export interface LifecycleResult {
  expired: number;
  cancelled: number;
  renewalNotices: number;
}

/**
 * The managed renewal flow, run by the scheduled job:
 * - subscriptions whose period has ended lapse to EXPIRED (or CANCELLED when the doctor asked
 *   for cancellation before the end of the period);
 * - subscriptions ending within the next 7 days get a renewal notice.
 */
export async function processSubscriptionLifecycle(now = new Date()): Promise<LifecycleResult> {
  const ended = await prisma.doctorSubscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lte: now } },
    include: { doctor: { select: { userId: true } } },
  });
  for (const subscription of ended) {
    const cancelled = subscription.cancelAtPeriodEnd;
    // Conditional transition: if a renewal extended the period between our read and this write,
    // this claims nothing and the subscription stays ACTIVE. Never overwrite a live plan.
    const claimed = await prisma.doctorSubscription.updateMany({
      where: { id: subscription.id, status: "ACTIVE", currentPeriodEnd: { lte: now } },
      data: { status: cancelled ? "CANCELLED" : "EXPIRED" },
    });
    if (claimed.count === 0) continue;
    await prisma.subscriptionEvent.create({
      data: { subscriptionId: subscription.id, type: cancelled ? "CANCELLED" : "EXPIRED", details: {} },
    });
    queueNotification(
      subscription.doctor.userId,
      cancelled
        ? { kind: "SUBSCRIPTION_CANCELLED", subscriptionId: subscription.id }
        : { kind: "SUBSCRIPTION_EXPIRED", subscriptionId: subscription.id },
    );
  }

  const soon = new Date(now.getTime() + 7 * 86_400_000);
  const upcoming = await prisma.doctorSubscription.findMany({
    where: { status: "ACTIVE", cancelAtPeriodEnd: false, currentPeriodEnd: { gt: now, lte: soon } },
    include: { doctor: { select: { userId: true } } },
  });
  for (const subscription of upcoming) {
    // One notice per subscription per period: only when we have not already queued a renewal event.
    const recentNotice = await prisma.subscriptionEvent.findFirst({
      where: { subscriptionId: subscription.id, type: "RENEWAL_NOTICE", createdAt: { gt: subscription.currentPeriodStart } },
      select: { id: true },
    });
    if (recentNotice) continue;
    await prisma.subscriptionEvent.create({
      data: { subscriptionId: subscription.id, type: "RENEWAL_NOTICE", details: { endsAt: subscription.currentPeriodEnd } },
    });
    queueNotification(subscription.doctor.userId, { kind: "SUBSCRIPTION_RENEWAL_DUE", subscriptionId: subscription.id });
  }

  return {
    expired: ended.filter((s) => !s.cancelAtPeriodEnd).length,
    cancelled: ended.filter((s) => s.cancelAtPeriodEnd).length,
    renewalNotices: upcoming.length,
  };
}

/** Monthly revenue from active subscriptions (for admin reporting). */
export async function subscriptionRevenueByMonth(months = 12): Promise<Array<{ month: string; revenue: number; activeSubscriptions: number }>> {
  const rows = await prisma.$queryRaw<Array<{ month: Date; revenue: string; subs: bigint }>>`
    SELECT date_trunc('month', "current_period_start") AS month,
           COALESCE(SUM("monthly_price"), 0) AS revenue,
           COUNT(*) AS subs
    FROM "doctor_subscriptions" ds
    JOIN "subscription_plans" sp ON sp.id = ds.plan_id
    WHERE ds.status = 'ACTIVE'
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT ${months}`;
  return rows.map((row) => ({ month: row.month.toISOString().slice(0, 7), revenue: Number(row.revenue), activeSubscriptions: Number(row.subs) }));
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  if (result.getDate() < day) result.setDate(0); // clamp to the last day of the target month
  return result;
}

export const monthlyPriceNumber = (plan: Pick<SubscriptionPlan, "monthlyPrice">) => round2(Number(plan.monthlyPrice));
