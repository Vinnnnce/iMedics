import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { ApiError, badRequest, conflict, notFound } from "./errors";
import { queueNotification } from "./notifications/service";
import { newReference, holdExpiry } from "./payments/refs";
import { getPaymentProvider } from "./payments/provider";

/**
 * Facility subscriptions and the launch free trial.
 *
 * Every verified facility gets a free trial (30 days by default, FACILITY_TRIAL_DAYS). A launch
 * promotion can hold every trial open until a fixed date (LAUNCH_FREE_UNTIL, e.g. 2026-12-31).
 * When the trial ends, a facility needs a paid plan to keep *creating* records. Its existing
 * records always stay readable and exportable, and safety-critical work never stops.
 *
 * Nobody is locked out by an unfinished billing setup: restrictions only apply once at least one
 * facility plan exists with confirmed pricing (`features.pricingConfirmed`).
 */

type Db = PrismaClient | Prisma.TransactionClient;
type Env = Record<string, string | undefined>;

export const DEFAULT_TRIAL_DAYS = 30;
export const DEFAULT_GRACE_DAYS = 7;
const DAY = 86_400_000;

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && value?.trim() !== "" ? n : fallback;
}
export const trialDays = (env: Env = process.env) => positiveInt(env.FACILITY_TRIAL_DAYS, DEFAULT_TRIAL_DAYS);
export const graceDays = (env: Env = process.env) => positiveInt(env.FACILITY_GRACE_DAYS, DEFAULT_GRACE_DAYS);

/** Optional launch promotion: no trial ends before this date. */
export function launchFreeUntil(env: Env = process.env): Date | null {
  const raw = env.LAUNCH_FREE_UNTIL?.trim();
  if (!raw) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999Z` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function computeTrialEnd(start: Date, env: Env = process.env): Date {
  const byDays = new Date(start.getTime() + trialDays(env) * DAY);
  const promo = launchFreeUntil(env);
  return promo && promo > byDays ? promo : byDays;
}

export type AccessPhase = "UNMETERED" | "TRIAL" | "PAID" | "GRACE" | "READ_ONLY" | "FREE_UNTIL_PLANS";

export interface AccessState {
  phase: AccessPhase;
  /** May the facility create and change records (outside the always-allowed safety work)? */
  canWrite: boolean;
  /** TRIAL/PAID: when the current period ends. GRACE: when the grace period ends. READ_ONLY: when access lapsed. */
  endsAt: Date | null;
  daysLeft: number | null;
}

export interface SubscriptionLike {
  status: "TRIALING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
}

const daysUntil = (to: Date, now: Date) => Math.max(0, Math.ceil((to.getTime() - now.getTime()) / DAY));

/** Pure: what a facility may do right now. */
export function resolveAccessState(sub: SubscriptionLike | null, billingConfigured: boolean, now = new Date(), env: Env = process.env): AccessState {
  if (!sub) return { phase: "UNMETERED", canWrite: true, endsAt: null, daysLeft: null };
  if (sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd > now) {
    return { phase: "PAID", canWrite: true, endsAt: sub.currentPeriodEnd, daysLeft: daysUntil(sub.currentPeriodEnd, now) };
  }
  if (sub.status === "TRIALING" && sub.trialEndsAt > now) {
    return { phase: "TRIAL", canWrite: true, endsAt: sub.trialEndsAt, daysLeft: daysUntil(sub.trialEndsAt, now) };
  }
  const lapsedAt = sub.currentPeriodEnd && sub.currentPeriodEnd > sub.trialEndsAt ? sub.currentPeriodEnd : sub.trialEndsAt;
  if (!billingConfigured) return { phase: "FREE_UNTIL_PLANS", canWrite: true, endsAt: lapsedAt, daysLeft: null };
  const graceEnds = new Date(lapsedAt.getTime() + graceDays(env) * DAY);
  if (graceEnds > now) return { phase: "GRACE", canWrite: true, endsAt: graceEnds, daysLeft: daysUntil(graceEnds, now) };
  return { phase: "READ_ONLY", canWrite: false, endsAt: lapsedAt, daysLeft: null };
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Writes that must keep working after a trial ends: billing itself, patient-safety work (critical
 * results, emergency care, nursing, medication administration and dispensing, break-glass access)
 * and the records export that lets a facility take its data with it.
 */
const ALWAYS_ALLOWED_PREFIXES = [
  "/api/facility/subscription",
  "/api/payments",
  "/api/facility/critical-alerts",
  "/api/facility/his/emergency",
  "/api/facility/his/nursing",
  "/api/facility/his/medication-orders",
  "/api/facility/his/pharmacy",
  "/api/facility/break-glass",
] as const;

export function isAlwaysAllowedPath(pathname: string): boolean {
  if (ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  return /^\/api\/facility\/his\/patients\/[^/]+\/package$/.test(pathname);
}

export const SUBSCRIPTION_ENDED_MESSAGE =
  "Your free trial has ended. Choose a plan to keep creating new records. Your existing records stay available to view and export.";

/** Plans exist with confirmed pricing, so restrictions can be applied fairly. */
export async function billingConfigured(db: Db = prisma): Promise<boolean> {
  const plan = await db.subscriptionPlan.findFirst({
    where: { audience: "FACILITY", active: true, features: { path: ["pricingConfirmed"], equals: true } },
    select: { id: true },
  });
  return Boolean(plan);
}

export async function getFacilityAccessState(facilityId: string, db: Db = prisma, now = new Date()): Promise<{ state: AccessState; subscription: Awaited<ReturnType<typeof loadSubscription>> }> {
  const subscription = await loadSubscription(facilityId, db);
  let state = resolveAccessState(subscription, true, now);
  // Only look at billing when the answer depends on it.
  if (state.phase === "GRACE" || state.phase === "READ_ONLY") state = resolveAccessState(subscription, await billingConfigured(db), now);
  return { state, subscription };
}

function loadSubscription(facilityId: string, db: Db) {
  return db.facilitySubscription.findUnique({ where: { facilityId }, include: { plan: { select: { code: true, name: true } } } });
}

/** Guard for facility API writes. Reads are never blocked. A facility with no subscription row is not restricted. */
export async function assertFacilityMayWrite(facilityId: string, method: string, pathname: string, db: Db = prisma): Promise<void> {
  if (!WRITE_METHODS.has(method.toUpperCase()) || isAlwaysAllowedPath(pathname)) return;
  const { state } = await getFacilityAccessState(facilityId, db);
  if (!state.canWrite) throw new ApiError(402, SUBSCRIPTION_ENDED_MESSAGE);
}

// ---------------------------------------------------------------------------
// Trials
// ---------------------------------------------------------------------------

/** Start the trial for a facility (idempotent). Called when a facility is verified. */
export async function ensureFacilityTrial(facilityId: string, db: Db = prisma, now = new Date()) {
  const existing = await db.facilitySubscription.findUnique({ where: { facilityId } });
  if (existing) return existing;
  try {
    return await db.facilitySubscription.create({
      data: {
        facilityId, status: "TRIALING", trialStartsAt: now, trialEndsAt: computeTrialEnd(now),
        events: { create: { type: "TRIAL_STARTED", details: { days: trialDays(), promoUntil: launchFreeUntil()?.toISOString() ?? null } } },
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return db.facilitySubscription.findUniqueOrThrow({ where: { facilityId } });
    throw error;
  }
}

export async function ensureTrialForUser(userId: string, db: Db = prisma): Promise<void> {
  const facility = await db.labStaffProfile.findFirst({ where: { userId }, select: { id: true } });
  if (facility) await ensureFacilityTrial(facility.id, db);
}

/** Safety net for the daily job: verified facilities that somehow have no subscription row. */
export async function ensureMissingTrials(now = new Date()): Promise<number> {
  const missing = await prisma.labStaffProfile.findMany({
    where: { verificationStatus: "VERIFIED", subscription: null }, select: { id: true }, take: 500,
  });
  for (const { id } of missing) await ensureFacilityTrial(id, prisma, now);
  return missing.length;
}

/** Support tool: give a facility more time. Never shortens an existing trial. */
export async function extendFacilityTrial(facilityId: string, input: { days?: number; until?: Date }, actorUserId: string, reason: string, now = new Date()) {
  const subscription = await ensureFacilityTrial(facilityId, prisma, now);
  const base = subscription.trialEndsAt > now ? subscription.trialEndsAt : now;
  const target = input.until ?? new Date(base.getTime() + (input.days ?? 0) * DAY);
  if (target <= subscription.trialEndsAt) throw badRequest("The new date must be later than the current trial end");
  if (target.getTime() - now.getTime() > 366 * DAY) throw badRequest("A trial cannot be extended by more than a year at once");
  return prisma.facilitySubscription.update({
    where: { id: subscription.id },
    data: {
      trialEndsAt: target,
      // A facility that never paid goes back to TRIALING; a paying one keeps its paid state.
      ...(subscription.status === "EXPIRED" && !subscription.currentPeriodEnd ? { status: "TRIALING" as const } : {}),
      events: { create: { type: "TRIAL_EXTENDED", actorUserId, details: { from: subscription.trialEndsAt.toISOString(), to: target.toISOString(), reason } } },
    },
  });
}

// ---------------------------------------------------------------------------
// Purchase and activation
// ---------------------------------------------------------------------------

export async function listFacilityPlans(db: Db = prisma) {
  const plans = await db.subscriptionPlan.findMany({ where: { audience: "FACILITY", active: true }, orderBy: { sortOrder: "asc" } });
  return plans.map((p) => ({ code: p.code, name: p.name, monthlyPrice: Number(p.monthlyPrice), currency: p.currency, features: p.features, purchasable: (p.features as { pricingConfirmed?: unknown } | null)?.pricingConfirmed === true }));
}

/** Create the charge for a plan. The plan only applies when the verified payment succeeds. */
export async function prepareFacilityPurchase(userId: string, facilityId: string, planCode: string): Promise<{ paymentId: string }> {
  const plan = await prisma.subscriptionPlan.findFirst({ where: { code: planCode, audience: "FACILITY", active: true } });
  if (!plan) throw notFound("Plan not found");
  if ((plan.features as { pricingConfirmed?: unknown } | null)?.pricingConfirmed !== true) {
    throw conflict("This plan's pricing has not been confirmed yet, so purchases are temporarily disabled.");
  }
  const platform = await prisma.user.findFirst({ where: { role: "ADMIN", status: "ACTIVE", deletedAt: null }, select: { id: true } });
  if (!platform) throw conflict("The platform account is not configured yet. Please try again later.");
  await ensureFacilityTrial(facilityId);
  const payment = await prisma.payment.create({
    data: {
      kind: "SUBSCRIPTION", payerId: userId, payeeId: platform.id, description: `Facility subscription: ${plan.name}`,
      amount: plan.monthlyPrice, currency: plan.currency, provider: getPaymentProvider().name,
      providerReference: newReference(), expiresAt: holdExpiry(),
      events: { create: { type: "CREATED", details: { planCode: plan.code, facilityId } } },
    },
  });
  return { paymentId: payment.id };
}

const addMonths = (date: Date, months: number) => { const d = new Date(date); d.setUTCMonth(d.getUTCMonth() + months); return d; };

/**
 * A facility subscription charge succeeded: apply the plan. Exactly once per payment (the consuming
 * event has a unique payment id) and serialized per facility, like the doctor flow. Returns false
 * when the payment is not a facility subscription so the caller can fall through to the doctor flow.
 */
export async function activateFacilitySubscriptionForPayment(paymentId: string, db: PrismaClient = prisma): Promise<boolean> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: { status: true, payerId: true, events: { where: { type: "CREATED" }, take: 1, orderBy: { createdAt: "asc" } } },
  });
  const details = payment?.events[0]?.details as { planCode?: string; facilityId?: string } | undefined;
  if (!payment || !details?.facilityId) return false;
  if (payment.status !== "SUCCESSFUL") return true;
  const plan = details.planCode ? await db.subscriptionPlan.findFirst({ where: { code: details.planCode, audience: "FACILITY" } }) : null;
  if (!plan) return true;

  // The payer must belong to the facility the charge names.
  const facility = await db.labStaffProfile.findUnique({ where: { id: details.facilityId }, select: { id: true, userId: true } });
  if (!facility) return true;
  const isStaff = facility.userId === payment.payerId || Boolean(await db.facilityStaff.findFirst({ where: { facilityId: facility.id, userId: payment.payerId, status: "ACTIVE" }, select: { id: true } }));
  if (!isStaff) return true;

  let activated: { subscriptionId: string; type: "STARTED" | "RENEWED" | "PLAN_CHANGED" } | null = null;
  try {
    activated = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"facility-sub:" + facility.id}))`;
      if (await tx.facilitySubscriptionEvent.findFirst({ where: { paymentId }, select: { id: true } })) return null;
      const now = new Date();
      let subscription = await tx.facilitySubscription.findUnique({ where: { facilityId: facility.id } });
      if (!subscription) subscription = await ensureFacilityTrial(facility.id, tx, now);
      const wasActive = subscription.status === "ACTIVE" && !!subscription.currentPeriodEnd && subscription.currentPeriodEnd > now;
      const samePlan = subscription.planId === plan.id;
      const base = wasActive && samePlan ? subscription.currentPeriodEnd! : now;
      const type = wasActive ? (samePlan ? "RENEWED" : "PLAN_CHANGED") : "STARTED";
      await tx.facilitySubscriptionEvent.create({ data: { subscriptionId: subscription.id, type, paymentId, details: { planCode: plan.code } } });
      await tx.facilitySubscription.update({
        where: { id: subscription.id },
        data: { status: "ACTIVE", planId: plan.id, currentPeriodStart: now, currentPeriodEnd: addMonths(base, 1), cancelAtPeriodEnd: false, paymentId },
      });
      return { subscriptionId: subscription.id, type };
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return true;
    throw error;
  }
  if (activated) queueNotification(facility.userId, { kind: "FACILITY_SUBSCRIPTION_ACTIVATED", facilityId: facility.id });
  return true;
}

export async function setFacilityCancelAtPeriodEnd(facilityId: string, cancel: boolean): Promise<void> {
  const sub = await prisma.facilitySubscription.findUnique({ where: { facilityId } });
  if (!sub || sub.status !== "ACTIVE") throw conflict("There is no active paid plan to change");
  await prisma.facilitySubscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: cancel } });
}

// ---------------------------------------------------------------------------
// Daily lifecycle
// ---------------------------------------------------------------------------

export interface FacilityLifecycleResult { trialsStarted: number; trialsEnded: number; paidEnded: number; notices: number }

/** The notice that applies for a given number of days left (one per threshold, smallest that fits). */
export function noticeThreshold(daysLeft: number): 14 | 7 | 1 | null {
  if (daysLeft <= 0 || daysLeft > 14) return null;
  return daysLeft > 7 ? 14 : daysLeft > 1 ? 7 : 1;
}

export async function processFacilityLifecycle(now = new Date()): Promise<FacilityLifecycleResult> {
  const trialsStarted = await ensureMissingTrials(now);
  let trialsEnded = 0;
  let paidEnded = 0;
  let notices = 0;

  const endedTrials = await prisma.facilitySubscription.findMany({
    where: { status: "TRIALING", trialEndsAt: { lte: now } }, include: { facility: { select: { userId: true } } },
  });
  for (const sub of endedTrials) {
    const claimed = await prisma.facilitySubscription.updateMany({ where: { id: sub.id, status: "TRIALING", trialEndsAt: { lte: now } }, data: { status: "EXPIRED" } });
    if (claimed.count === 0) continue;
    trialsEnded += 1;
    await prisma.facilitySubscriptionEvent.createMany({ data: [{ subscriptionId: sub.id, type: "EXPIRED", details: { trial: true } }, { subscriptionId: sub.id, type: "NOTICE_ENDED", details: {} }] });
    queueNotification(sub.facility.userId, { kind: "FACILITY_TRIAL_ENDED", facilityId: sub.facilityId });
  }

  const endedPaid = await prisma.facilitySubscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lte: now } }, include: { facility: { select: { userId: true } } },
  });
  for (const sub of endedPaid) {
    const claimed = await prisma.facilitySubscription.updateMany({
      where: { id: sub.id, status: "ACTIVE", currentPeriodEnd: { lte: now } },
      data: { status: sub.cancelAtPeriodEnd ? "CANCELLED" : "EXPIRED" },
    });
    if (claimed.count === 0) continue;
    paidEnded += 1;
    await prisma.facilitySubscriptionEvent.createMany({ data: [{ subscriptionId: sub.id, type: sub.cancelAtPeriodEnd ? "CANCELLED" : "EXPIRED", details: {} }, { subscriptionId: sub.id, type: "NOTICE_ENDED", details: {} }] });
    queueNotification(sub.facility.userId, { kind: "FACILITY_TRIAL_ENDED", facilityId: sub.facilityId });
  }

  const horizon = new Date(now.getTime() + 14 * DAY);
  const upcoming = await prisma.facilitySubscription.findMany({
    where: { OR: [{ status: "TRIALING", trialEndsAt: { gt: now, lte: horizon } }, { status: "ACTIVE", cancelAtPeriodEnd: false, currentPeriodEnd: { gt: now, lte: horizon } }] },
    include: { facility: { select: { userId: true } } },
  });
  for (const sub of upcoming) {
    const end = sub.status === "TRIALING" ? sub.trialEndsAt : sub.currentPeriodEnd!;
    const threshold = noticeThreshold(daysUntil(end, now));
    if (!threshold) continue;
    const type = `NOTICE_${threshold}`;
    const since = sub.status === "ACTIVE" ? sub.currentPeriodStart ?? sub.createdAt : sub.createdAt;
    if (await prisma.facilitySubscriptionEvent.findFirst({ where: { subscriptionId: sub.id, type, createdAt: { gt: since } }, select: { id: true } })) continue;
    await prisma.facilitySubscriptionEvent.create({ data: { subscriptionId: sub.id, type, details: { endsAt: end.toISOString() } } });
    queueNotification(sub.facility.userId, sub.status === "TRIALING"
      ? { kind: "FACILITY_TRIAL_ENDING", facilityId: sub.facilityId, daysLeft: threshold }
      : { kind: "FACILITY_RENEWAL_DUE", facilityId: sub.facilityId });
    notices += 1;
  }

  return { trialsStarted, trialsEnded, paidEnded, notices };
}

