/**
 * Admin control of facility plans and trials, through the real route handlers and database.
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

describe.skipIf(!url)("admin facility plans and trials", () => {
  type Prisma = typeof import("./prisma").prisma;
  let prisma: Prisma;
  let lib: typeof import("./facility-subscriptions");
  const runId = randomBytes(6).toString("hex");
  const manifest: AcceptanceManifest = {
    version: 1, runId, mode: "local-database-only", baseUrl: "http://localhost:3000", expiresAt: new Date(Date.now() + DAY).toISOString(),
    instanceId: null, databaseHost: "localhost", databaseName: "adm_test", users: [], facilities: [],
  };
  const adminClerk = `adm-${runId}`;
  const facilityId = () => manifest.facilities[0].id;
  const loaded = new Map<string, Record<string, (req: Request, ctx: { params: Promise<unknown> }) => Promise<Response>>>();
  interface Json { error?: string; plan?: { code: string; monthlyPrice: unknown; features: { pricingConfirmed?: boolean } }; subscriptions?: { facility: { laboratoryName: string | null } }[]; trialEndsAt?: string; phase?: string }

  async function call(as: string, method: string, route: string, body?: unknown) {
    currentClerkId = as;
    let mod = loaded.get(route);
    if (!mod) { mod = (await import(/* @vite-ignore */ `@/app/api/${route}/route`)) as never; loaded.set(route, mod!); }
    const res = await mod![method](new Request(`http://localhost:3000/api/${route}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: body === undefined ? undefined : { "content-type": "application/json" } }), { params: Promise.resolve({}) });
    return { status: res.status, json: (await res.json().catch(() => null)) as Json | null };
  }
  const plan = (over: Record<string, unknown> = {}) => ({ code: `fac-${runId}`, name: "Facility Standard", monthlyPrice: 25000, currency: "NGN", sortOrder: 1, ...over });

  beforeAll(async () => {
    prisma = (await import("./prisma")).prisma;
    lib = await import("./facility-subscriptions");
    const identities = new Map(acceptanceRoster(runId).map((r) => [r.email, `local_test_${runId}_${r.hospital}_${r.role}`]));
    await createAcceptanceFixtures(prisma, manifest, identities);
    await prisma.user.create({ data: { clerkId: adminClerk, email: `${adminClerk}@t.test`, name: "Admin", role: "ADMIN", onboardingComplete: true } });
  }, 120_000);
  afterAll(async () => { await prisma.$disconnect(); });

  it("a draft price does not switch restrictions on; confirming it does", async () => {
    expect(await lib.billingConfigured()).toBe(false);
    const created = await call(adminClerk, "POST", "admin/facility-plans", plan());
    expect(created.status).toBe(201);
    expect(created.json?.plan?.features.pricingConfirmed).toBe(false);
    expect(await lib.billingConfigured()).toBe(false);
    const confirmed = await call(adminClerk, "POST", "admin/facility-plans", plan({ pricingConfirmed: true }));
    expect(confirmed.status).toBe(200);
    expect(await lib.billingConfigured()).toBe(true);
  });

  it("editing a plan without mentioning confirmation leaves it confirmed", async () => {
    const edited = await call(adminClerk, "POST", "admin/facility-plans", plan({ monthlyPrice: 30000 }));
    expect(edited.status).toBe(200);
    expect(Number(edited.json?.plan?.monthlyPrice)).toBe(30000);
    expect(edited.json?.plan?.features.pricingConfirmed).toBe(true);
    expect(await lib.billingConfigured()).toBe(true);
  });

  it("hiding the only confirmed plan turns restrictions off again", async () => {
    await call(adminClerk, "POST", "admin/facility-plans", plan({ active: false }));
    expect(await lib.billingConfigured()).toBe(false);
    await call(adminClerk, "POST", "admin/facility-plans", plan({ active: true }));
    expect(await lib.billingConfigured()).toBe(true);
  });

  it("rejects bad codes and will not touch a doctor plan", async () => {
    expect((await call(adminClerk, "POST", "admin/facility-plans", plan({ code: "Bad Code!" }))).status).toBe(400);
    expect((await call(adminClerk, "POST", "admin/facility-plans", plan({ monthlyPrice: -5, code: "neg-plan" }))).status).toBe(400);
    await prisma.subscriptionPlan.create({ data: { code: `doc-${runId}`, name: "Doctor plan", monthlyPrice: 1000, features: {} } });
    expect((await call(adminClerk, "POST", "admin/facility-plans", plan({ code: `doc-${runId}` }))).status).toBe(409);
  });

  it("only administrators can manage plans or trials", async () => {
    const owner = manifest.users.find((u) => u.hospital === "a" && u.role === "owner")!;
    expect((await call(owner.clerkId, "POST", "admin/facility-plans", plan())).status).toBe(403);
    expect((await call(owner.clerkId, "GET", "admin/facility-subscriptions")).status).toBe(403);
    expect((await call(owner.clerkId, "PATCH", "admin/facility-subscriptions", { facilityId: facilityId(), days: 30, reason: "I would like more time please" })).status).toBe(403);
  });

  it("lists facilities with their names and extends a trial with an audited reason", async () => {
    await lib.ensureFacilityTrial(facilityId());
    const list = await call(adminClerk, "GET", "admin/facility-subscriptions");
    expect(list.status).toBe(200);
    expect(list.json?.subscriptions?.some((s) => s.facility.laboratoryName)).toBe(true);
    const before = (await prisma.facilitySubscription.findUniqueOrThrow({ where: { facilityId: facilityId() } })).trialEndsAt;
    const reason = "Facility onboarding delayed by building works";
    const extended = await call(adminClerk, "PATCH", "admin/facility-subscriptions", { facilityId: facilityId(), days: 30, reason });
    expect(extended.status).toBe(200);
    expect(new Date(extended.json!.trialEndsAt!).getTime()).toBeGreaterThan(before.getTime() + 29 * DAY);
    const audit = await prisma.auditLog.findFirst({ where: { action: "ADMIN_FACILITY_TRIAL_EXTENDED", resourceId: facilityId() }, orderBy: { createdAt: "desc" } });
    expect(JSON.stringify(audit?.details)).toContain(reason);
  });

  it("validates extension requests", async () => {
    const ok = "A proper reason for the extension";
    expect((await call(adminClerk, "PATCH", "admin/facility-subscriptions", { facilityId: facilityId(), days: 7, reason: "short" })).status).toBe(400);
    expect((await call(adminClerk, "PATCH", "admin/facility-subscriptions", { facilityId: facilityId(), reason: ok })).status).toBe(400);
    expect((await call(adminClerk, "PATCH", "admin/facility-subscriptions", { facilityId: facilityId(), days: 7, until: "2030-01-01", reason: ok })).status).toBe(400);
    expect((await call(adminClerk, "PATCH", "admin/facility-subscriptions", { facilityId: "3f1c7b52-3c1b-4a43-9b1e-6c5d3d9f2a10", days: 7, reason: ok })).status).toBe(404);
    expect((await call(adminClerk, "PATCH", "admin/facility-subscriptions", { facilityId: facilityId(), until: new Date(Date.now() + DAY).toISOString(), reason: ok })).status).toBe(400);
  });
});
