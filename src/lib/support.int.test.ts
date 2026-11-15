/**
 * Support tickets and the rate limiter against a real Postgres.
 * Skipped unless TEST_DATABASE_URL points at a migrated, disposable database.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.RESEND_API_KEY = "";

describe.skipIf(!url)("support tickets and rate limiting", () => {
  type Prisma = typeof import("./prisma").prisma;
  let prisma: Prisma;
  let rl: typeof import("./rate-limit");
  let svc: typeof import("./support-service");
  const tag = Math.random().toString(36).slice(2, 8);
  let adminId = "";

  beforeAll(async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    prisma = (await import("./prisma")).prisma;
    rl = await import("./rate-limit");
    svc = await import("./support-service");
    const admin = await prisma.user.create({ data: { clerkId: `sup-${tag}`, email: `sup-${tag}@test.local`, name: "Support Tester", role: "ADMIN", onboardingComplete: true } });
    adminId = admin.id;
  });
  afterAll(async () => {
    await prisma.supportTicket.deleteMany({ where: { contactEmail: { contains: tag } } });
    await prisma.rateLimitBucket.deleteMany({ where: { key: { contains: tag } } });
    // audit_logs is append-only by design, so the tagged test user stays in the disposable database.
    await prisma.$disconnect();
  });

  it("counts atomically and blocks after the limit", async () => {
    const policy = { scope: `it-${tag}`, limit: 3, windowSeconds: 60 };
    for (let i = 0; i < 3; i += 1) await rl.enforceRateLimit(policy, "same");
    await expect(rl.enforceRateLimit(policy, "same")).rejects.toMatchObject({ status: 429 });
    await expect(rl.enforceRateLimit(policy, "someone-else")).resolves.toBeUndefined();
  });

  it("does not under-count concurrent requests", async () => {
    const policy = { scope: `conc-${tag}`, limit: 5, windowSeconds: 60 };
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => rl.enforceRateLimit(policy, "burst")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(7);
  });

  it("starts a new window once the old one has passed", async () => {
    const policy = { scope: `win-${tag}`, limit: 1, windowSeconds: 60 };
    const t0 = Date.now();
    await rl.enforceRateLimit(policy, "w", { now: t0 });
    await expect(rl.enforceRateLimit(policy, "w", { now: t0 })).rejects.toMatchObject({ status: 429 });
    await expect(rl.enforceRateLimit(policy, "w", { now: t0 + 61_000 })).resolves.toBeUndefined();
  });

  it("creates an anonymous ticket with a reference, SLA and creation event", async () => {
    const ticket = await svc.createSupportTicket({ type: "TECHNICAL", subject: "Cannot log in", message: "The login page keeps failing.", contactName: "Visitor", contactEmail: `visitor-${tag}@test.local` });
    const stored = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id }, include: { events: true } });
    expect(stored.reference).toMatch(/^SUP-/);
    expect(stored.status).toBe("OPEN");
    expect(stored.reporterUserId).toBeNull();
    expect(stored.slaDueAt.getTime()).toBeGreaterThan(Date.now());
    expect(stored.events.map((e) => e.kind)).toEqual(["CREATED"]);
  });

  it("marks security reports urgent and opens an incident for signed-in reporters", async () => {
    const ticket = await svc.createSupportTicket(
      { type: "SECURITY", subject: "Someone opened my record", message: "I saw an access I do not recognise.", contactName: "Support Tester", contactEmail: `sup-${tag}@test.local`, reporterUserId: adminId },
      { id: adminId, role: "ADMIN" },
    );
    const stored = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(stored.priority).toBe("URGENT");
    expect(stored.securityIncidentId).toBeTruthy();
    const incident = await prisma.securityIncident.findUniqueOrThrow({ where: { id: stored.securityIncidentId! } });
    expect(incident.severity).toBe("HIGH");
    expect(incident.reportedById).toBe(adminId);
  });

  it("keeps references unique and tickets filterable by reporter", async () => {
    const a = await svc.createSupportTicket({ type: "FEEDBACK", subject: "Nice", message: "Works well for me.", contactName: "A", contactEmail: `a-${tag}@test.local`, reporterUserId: adminId }, { id: adminId, role: "ADMIN" });
    const mine = await prisma.supportTicket.findMany({ where: { reporterUserId: adminId } });
    expect(mine.some((t) => t.id === a.id)).toBe(true);
    expect(new Set(mine.map((t) => t.reference)).size).toBe(mine.length);
  });
});
