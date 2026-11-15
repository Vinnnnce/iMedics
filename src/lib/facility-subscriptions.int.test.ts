/**
 * Facility trial and subscription lifecycle against a real Postgres, through real route handlers.
 * Skipped unless HIS_TEST_DATABASE_URL points at a migrated, disposable, empty database.
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { acceptanceRoster } from "./his/acceptance-config";
import { createAcceptanceFixtures, type AcceptanceManifest } from "../../scripts/lib/his-fixtures";

let currentClerkId: string | null = null;
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: currentClerkId }), currentUser: async () => null,
  clerkClient: async () => ({ users: { getUserList: async () => ({ data: [], totalCount: 0 }) } }),
}));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => unknown) => { void Promise.resolve().then(fn); } }));

const url = process.env.HIS_TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
const DAY = 86_400_000;
interface ApiJson { error?: string; state: { phase: string; canWrite: boolean }; subscription: { status: string }; plans: { code: string }[] }

describe.skipIf(!url)("facility subscriptions", () => {
  type Prisma = typeof import("./prisma").prisma;
  let prisma: Prisma;
  let lib: typeof import("./facility-subscriptions");
  let subs: typeof import("./subscriptions");
  const runId = randomBytes(6).toString("hex");
  const manifest: AcceptanceManifest = {
    version: 1, runId, mode: "local-database-only", baseUrl: "http://localhost:3000", expiresAt: new Date(Date.now() + DAY).toISOString(),
    instanceId: null, databaseHost: "localhost", databaseName: "sub_test", users: [], facilities: [],
  };
  const facility = (h: "a" | "b") => manifest.facilities.find((f) => f.hospital === h)!;
  const ownerClerk = (h: "a" | "b") => manifest.users.find((u) => u.hospital === h && u.role === "owner")!;
  const loaded = new Map<string, Record<string, (req: Request, ctx: { params: Promise<unknown> }) => Promise<Response>>>();

  async function call(clerkId: string, method: string, route: string, apiPath: string, params: Record<string, string> = {}, body?: unknown, facilityId?: string) {
    currentClerkId = clerkId;
    let mod = loaded.get(route);
    if (!mod) { mod = (await import(/* @vite-ignore */ `@/app/api/${route}/route`)) as never; loaded.set(route, mod!); }
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (facilityId) headers["x-facility-id"] = facilityId;
    const res = await mod![method](new Request(`http://localhost:3000${apiPath}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers }), { params: Promise.resolve(params) });
    return { status: res.status, json: (await res.json().catch(() => null)) as ApiJson | null };
  }

  const setSub = (h: "a" | "b", data: Record<string, unknown>) => prisma.facilitySubscription.update({ where: { facilityId: facility(h).id }, data: data as never });
  let planCode = "";

  beforeAll(async () => {
    prisma = (await import("./prisma")).prisma;
    lib = await import("./facility-subscriptions");
    subs = await import("./subscriptions");
    const identities = new Map(acceptanceRoster(runId).map((r) => [r.email, `local_test_${runId}_${r.hospital}_${r.role}`]));
    await createAcceptanceFixtures(prisma, manifest, identities);
    await prisma.user.create({ data: { clerkId: `plat-${runId}`, email: `plat-${runId}@t.test`, name: "Platform", role: "ADMIN", onboardingComplete: true } });
    planCode = `fac-basic-${runId}`;
  }, 120_000);
  afterAll(async () => { await prisma.$disconnect(); });

  it("starts one 30-day trial per facility and never a second", async () => {
    const first = await lib.ensureFacilityTrial(facility("a").id);
    const again = await lib.ensureFacilityTrial(facility("a").id);
    expect(again.id).toBe(first.id);
    expect(first.status).toBe("TRIALING");
    expect(Math.round((first.trialEndsAt.getTime() - first.trialStartsAt.getTime()) / DAY)).toBe(30);
    const concurrent = await Promise.all(Array.from({ length: 5 }, () => lib.ensureFacilityTrial(facility("b").id)));
    expect(new Set(concurrent.map((s) => s.id)).size).toBe(1);
    expect(await prisma.facilitySubscriptionEvent.count({ where: { subscriptionId: first.id, type: "TRIAL_STARTED" } })).toBe(1);
  });

  it("the daily job creates missing trials for verified facilities", async () => {
    await prisma.facilitySubscription.deleteMany({ where: { facilityId: facility("b").id } });
    const result = await lib.processFacilityLifecycle();
    expect(result.trialsStarted).toBeGreaterThanOrEqual(1);
    expect(await prisma.facilitySubscription.findUnique({ where: { facilityId: facility("b").id } })).not.toBeNull();
  });

  it("sends one notice per threshold and ends trials exactly once", async () => {
    await setSub("b", { trialEndsAt: new Date(Date.now() + 5 * DAY) });
    const first = await lib.processFacilityLifecycle();
    const second = await lib.processFacilityLifecycle();
    expect(first.notices).toBeGreaterThanOrEqual(1);
    expect(second.notices).toBe(0);
    const bId = (await prisma.facilitySubscription.findUniqueOrThrow({ where: { facilityId: facility("b").id } })).id;
    expect(await prisma.facilitySubscriptionEvent.count({ where: { subscriptionId: bId, type: "NOTICE_7" } })).toBe(1);

    await setSub("a", { trialEndsAt: new Date(Date.now() - 2 * DAY) });
    const ended = await lib.processFacilityLifecycle();
    const again = await lib.processFacilityLifecycle();
    expect(ended.trialsEnded).toBe(1);
    expect(again.trialsEnded).toBe(0);
    const a = await prisma.facilitySubscription.findUniqueOrThrow({ where: { facilityId: facility("a").id }, include: { events: true } });
    expect(a.status).toBe("EXPIRED");
    expect(a.events.filter((e) => e.type === "NOTICE_ENDED")).toHaveLength(1);
  });

  const encounter = () => facility("a").encounterIds[0];
  const patchEncounter = () => call(ownerClerk("a").clerkId, "PATCH", "facility/his/encounters/[id]", `/api/facility/his/encounters/${encounter()}`, { id: encounter() }, { status: "CANCELLED" }, facility("a").id);

  it("does not restrict anyone while no priced plan exists, even after the trial and grace period", async () => {
    await setSub("a", { status: "EXPIRED", trialEndsAt: new Date(Date.now() - 60 * DAY) });
    expect((await patchEncounter()).status).not.toBe(402);
  });

  it("after the grace period a facility keeps reading and exporting but cannot create or change records", async () => {
    await prisma.subscriptionPlan.create({ data: { code: planCode, name: "Facility Basic", monthlyPrice: 50000, audience: "FACILITY", features: { pricingConfirmed: true } } });
    const blocked = await patchEncounter();
    expect(blocked.status).toBe(402);
    expect(blocked.json?.error).toMatch(/free trial has ended/i);
    const read = await call(ownerClerk("a").clerkId, "GET", "facility/subscription", "/api/facility/subscription", {}, undefined, facility("a").id);
    expect(read.status).toBe(200);
    expect(read.json?.state).toMatchObject({ phase: "READ_ONLY", canWrite: false });
    const exportPkg = await call(ownerClerk("a").clerkId, "POST", "facility/his/patients/[id]/package", `/api/facility/his/patients/${facility("a").patientId}/package`, { id: facility("a").patientId }, undefined, facility("a").id);
    expect(exportPkg.status).not.toBe(402);
    const staffWrite = await call(ownerClerk("a").clerkId, "POST", "facility/staff", "/api/facility/staff", {}, { email: "x@y.test", fullName: "New Person", facilityRole: "NURSE" }, facility("a").id);
    expect(staffWrite.status).toBe(402);
  });

  it("other facilities are unaffected, and each facility sees only its own plan state", async () => {
    const b = await call(ownerClerk("b").clerkId, "GET", "facility/subscription", "/api/facility/subscription", {}, undefined, facility("b").id);
    expect(b.json?.state.phase).toBe("TRIAL");
    expect(b.json?.subscription.status).toBe("TRIALING");
    expect(b.json?.plans.map((p: { code: string }) => p.code)).toContain(planCode);
    const bWrite = await call(ownerClerk("b").clerkId, "PATCH", "facility/his/encounters/[id]", `/api/facility/his/encounters/${facility("b").encounterIds[0]}`, { id: facility("b").encounterIds[0] }, { status: "CANCELLED" }, facility("b").id);
    expect(bWrite.status).not.toBe(402);
  });

  it("keeps facility plans away from doctors", async () => {
    expect((await subs.listPlans()).map((p) => p.code)).not.toContain(planCode);
    const doctor = await prisma.user.create({ data: { clerkId: `doc-${runId}`, email: `doc-${runId}@t.test`, name: "Doctor", role: "DOCTOR", onboardingComplete: true } });
    await prisma.doctorProfile.create({ data: { userId: doctor.id, verificationStatus: "VERIFIED" } });
    await expect(subs.prepareSubscriptionPurchase(doctor.id, planCode)).rejects.toMatchObject({ status: 404 });
  });

  it("refuses a purchase from staff without owner-level permission and for unconfirmed plans", async () => {
    const author = manifest.users.find((u) => u.hospital === "a" && u.role === "author")!;
    const denied = await call(author.clerkId, "POST", "facility/subscription/purchase", "/api/facility/subscription/purchase", {}, { planCode, method: "CARD" }, facility("a").id);
    expect([403, 503]).toContain(denied.status);
    await prisma.subscriptionPlan.create({ data: { code: `${planCode}-draft`, name: "Draft", monthlyPrice: 1, audience: "FACILITY", features: { pricingConfirmed: false } } });
    await expect(lib.prepareFacilityPurchase(ownerClerk("a").userId, facility("a").id, `${planCode}-draft`)).rejects.toMatchObject({ status: 409 });
  });

  async function paidCharge(h: "a" | "b", payerUserId: string) {
    const { paymentId } = await lib.prepareFacilityPurchase(payerUserId, facility(h).id, planCode);
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "SUCCESSFUL", paidAt: new Date() } });
    return paymentId;
  }

  it("applies a successful payment exactly once, even when it is replayed concurrently", async () => {
    const paymentId = await paidCharge("a", ownerClerk("a").userId);
    await Promise.all(Array.from({ length: 6 }, () => subs.activateSubscriptionForPayment(paymentId)));
    const sub = await prisma.facilitySubscription.findUniqueOrThrow({ where: { facilityId: facility("a").id }, include: { events: true } });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.events.filter((e) => e.paymentId === paymentId)).toHaveLength(1);
    expect(sub.events.find((e) => e.paymentId === paymentId)?.type).toBe("STARTED");
    const days = (sub.currentPeriodEnd!.getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(32);
    expect((await patchEncounter()).status).not.toBe(402);
  });

  it("renews from the end of the current period instead of overlapping it", async () => {
    const before = (await prisma.facilitySubscription.findUniqueOrThrow({ where: { facilityId: facility("a").id } })).currentPeriodEnd!;
    const paymentId = await paidCharge("a", ownerClerk("a").userId);
    await subs.activateSubscriptionForPayment(paymentId);
    const after = await prisma.facilitySubscription.findUniqueOrThrow({ where: { facilityId: facility("a").id }, include: { events: true } });
    expect(after.currentPeriodEnd!.getTime()).toBeGreaterThan(before.getTime() + 27 * DAY);
    expect(after.events.find((e) => e.paymentId === paymentId)?.type).toBe("RENEWED");
  });

  it("ignores a charge made by someone outside the facility it names", async () => {
    const outsider = ownerClerk("b").userId;
    const { paymentId } = await lib.prepareFacilityPurchase(outsider, facility("a").id, planCode);
    await prisma.payment.update({ where: { id: paymentId }, data: { status: "SUCCESSFUL", paidAt: new Date() } });
    const before = await prisma.facilitySubscription.findUniqueOrThrow({ where: { facilityId: facility("a").id } });
    await subs.activateSubscriptionForPayment(paymentId);
    const after = await prisma.facilitySubscription.findUniqueOrThrow({ where: { facilityId: facility("a").id } });
    expect(after.currentPeriodEnd!.getTime()).toBe(before.currentPeriodEnd!.getTime());
  });

  it("a paid plan that lapses goes through the same ending, and cancellation is honoured", async () => {
    await lib.setFacilityCancelAtPeriodEnd(facility("a").id, true);
    await setSub("a", { currentPeriodEnd: new Date(Date.now() - 1000) });
    const result = await lib.processFacilityLifecycle();
    expect(result.paidEnded).toBe(1);
    expect((await prisma.facilitySubscription.findUniqueOrThrow({ where: { facilityId: facility("a").id } })).status).toBe("CANCELLED");
  });

  it("support can extend a trial, which re-opens an expired facility and never shortens one", async () => {
    await setSub("a", { status: "EXPIRED", currentPeriodEnd: null, trialEndsAt: new Date(Date.now() - 60 * DAY), cancelAtPeriodEnd: false });
    expect((await patchEncounter()).status).toBe(402);
    const adminId = (await prisma.user.findFirstOrThrow({ where: { clerkId: `plat-${runId}` } })).id;
    const extended = await lib.extendFacilityTrial(facility("a").id, { days: 14 }, adminId, "Onboarding delayed by the facility");
    expect(extended.status).toBe("TRIALING");
    expect(extended.trialEndsAt.getTime()).toBeGreaterThan(Date.now() + 13 * DAY);
    expect((await patchEncounter()).status).not.toBe(402);
    await expect(lib.extendFacilityTrial(facility("a").id, { until: new Date(Date.now() + DAY) }, adminId, "Trying to shorten it")).rejects.toMatchObject({ status: 400 });
  });
});
