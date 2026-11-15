/**
 * Generated authorization matrix (launch criterion: 100% pass on critical role-permission tests).
 *
 * Every `withAuth` API handler is discovered from the source tree and then called for real, with
 * a real database user, as each kind of caller. No resource fixtures are needed because the gates
 * under test run before any handler logic:
 *
 *   - signed out                         -> 401 everywhere
 *   - suspended / banned / removed       -> 403 everywhere
 *   - unfinished registration            -> 403 unless the route opts in (allowOnboarding)
 *   - a role the route does not list     -> 403
 *
 * A new route is covered automatically. Skipped unless TEST_DATABASE_URL points at a migrated,
 * disposable database.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let currentClerkId: string | null = null;
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: currentClerkId }),
  currentUser: async () => null,
  clerkClient: async () => ({ users: { getUserList: async () => ({ data: [], totalCount: 0 }) } }),
}));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

type Role = "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
const ROLES: Role[] = ["PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"];
const API_ROOT = path.join(process.cwd(), "src/app/api");
const UUID = "3f1c7b52-3c1b-4a43-9b1e-6c5d3d9f2a10";

interface Handler { file: string; url: string; method: string; roles: Role[] | null; allowsOnboarding: boolean; params: Record<string, string | string[]> }

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? routeFiles(full) : name === "route.ts" ? [full] : [];
  });
}

function discover(): { handlers: Handler[]; unparsed: string[] } {
  const handlers: Handler[] = [];
  const unparsed: string[] = [];
  for (const file of routeFiles(API_ROOT)) {
    const source = readFileSync(file, "utf8");
    const dir = path.relative(API_ROOT, path.dirname(file)).split(path.sep).filter(Boolean);
    const params: Record<string, string | string[]> = {};
    const segments = dir.map((segment) => {
      const catchAll = segment.match(/^\[\.\.\.(\w+)\]$/);
      if (catchAll) { params[catchAll[1]] = ["x"]; return "x"; }
      const single = segment.match(/^\[(\w+)\]$/);
      if (single) { params[single[1]] = UUID; return UUID; }
      return segment;
    });
    const requestUrl = `http://localhost:3000/api/${segments.join("/")}`;
    for (const match of source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\s*=\s*withAuth(?:<[^>]*>)?\(\s*(null|\[[^\]]*\])/g)) {
      const roles = match[2] === "null" ? null : [...match[2].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1] as Role);
      if (roles && roles.length === 0) { unparsed.push(`${match[1]} ${requestUrl}`); continue; }
      handlers.push({ file, url: requestUrl, method: match[1], roles, allowsOnboarding: source.includes("allowOnboarding"), params });
    }
    for (const match of source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\s*=\s*withAuth/g)) {
      if (!handlers.some((h) => h.file === file && h.method === match[1])) unparsed.push(`${match[1]} ${requestUrl}`);
    }
  }
  return { handlers, unparsed };
}

const { handlers, unparsed } = discover();

describe.skipIf(!url)("authorization matrix (every withAuth route)", () => {
  type Prisma = typeof import("./prisma").prisma;
  let prisma: Prisma;
  const tag = Math.random().toString(36).slice(2, 8);
  const clerkIds: Record<string, string> = {};
  const modules = new Map<string, Record<string, (req: Request, ctx: { params: Promise<unknown> }) => Promise<Response>>>();

  async function call(h: Handler, clerkId: string | null): Promise<number> {
    currentClerkId = clerkId;
    let mod = modules.get(h.file);
    if (!mod) { mod = await import(/* @vite-ignore */ h.file); modules.set(h.file, mod!); }
    const body = h.method === "GET" || h.method === "DELETE" ? undefined : JSON.stringify({});
    const request = new Request(h.url, { method: h.method, body, headers: body ? { "content-type": "application/json" } : undefined });
    const response = await mod![h.method](request, { params: Promise.resolve(h.params) });
    return response.status;
  }

  async function sweep(clerkId: string | null, pick: (h: Handler) => boolean, expected: number): Promise<string[]> {
    const violations: string[] = [];
    for (const h of handlers.filter(pick)) {
      const status = await call(h, clerkId);
      if (status !== expected) violations.push(`${h.method} ${new URL(h.url).pathname} -> ${status} (expected ${expected})`);
    }
    return violations;
  }

  beforeAll(async () => {
    prisma = (await import("./prisma")).prisma;
    const make = async (key: string, data: Record<string, unknown>) => {
      clerkIds[key] = `matrix-${key}-${tag}`;
      await prisma.user.create({ data: { clerkId: clerkIds[key], email: `${key}-${tag}@matrix.test`, name: `Matrix ${key}`, role: "PATIENT", onboardingComplete: true, ...data } as never });
    };
    for (const role of ROLES) await make(role, { role });
    await make("SUSPENDED", { role: "ADMIN", status: "SUSPENDED" });
    await make("BANNED", { role: "DOCTOR", status: "BANNED" });
    await make("REMOVED", { role: "PATIENT", deletedAt: new Date() });
    await make("PENDING", { role: "PATIENT", onboardingComplete: false });
  }, 60_000);

  afterAll(async () => {
    try { await prisma.user.deleteMany({ where: { email: { endsWith: `-${tag}@matrix.test` } } }); } catch { /* audit rows are append-only */ }
    await prisma.$disconnect();
  });

  it("discovers and understands every withAuth handler", () => {
    expect(unparsed).toEqual([]);
    expect(handlers.length).toBeGreaterThan(400);
    expect(handlers.filter((h) => h.roles?.includes("ADMIN") && h.roles.length === 1).length).toBeGreaterThan(20);
  });

  it("control: the harness really authenticates (an allowed caller is not rejected at the gate)", async () => {
    const control = handlers.find((h) => h.url.endsWith("/api/support/tickets") && h.method === "GET")!;
    expect(await call(control, clerkIds.PATIENT)).toBe(200);
  }, 60_000);

  it("signed-out callers get 401 on every route", async () => {
    expect(await sweep(null, () => true, 401)).toEqual([]);
  }, 300_000);

  it.each(["SUSPENDED", "BANNED", "REMOVED"])("%s accounts get 403 on every route", async (key) => {
    expect(await sweep(clerkIds[key], () => true, 403)).toEqual([]);
  }, 300_000);

  it("unfinished registrations are refused on every route that does not opt in", async () => {
    expect(await sweep(clerkIds.PENDING, (h) => !h.allowsOnboarding, 403)).toEqual([]);
  }, 300_000);

  it.each(ROLES)("%s gets 403 on every route that does not list that role", async (role) => {
    expect(await sweep(clerkIds[role], (h) => h.roles !== null && !h.roles.includes(role), 403)).toEqual([]);
  }, 300_000);
});
