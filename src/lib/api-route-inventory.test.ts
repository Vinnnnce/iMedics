import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Authorization inventory. Every HTTP handler under src/app/api must declare how it is
 * protected. A new route that is not wrapped in withAuth (or on the reviewed lists below)
 * fails this test, so an unprotected endpoint cannot be added by accident.
 */
const API_ROOT = path.join(process.cwd(), "src/app/api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? routeFiles(full) : name === "route.ts" ? [full] : [];
  });
}

interface Handler { route: string; method: string; kind: "withAuth" | "cron" | "apiHandler" | "other"; source: string }

function handlers(): Handler[] {
  const found: Handler[] = [];
  for (const file of routeFiles(API_ROOT)) {
    const source = readFileSync(file, "utf8");
    const route = "/" + path.relative(path.join(process.cwd(), "src/app"), path.dirname(file)).replaceAll(path.sep, "/");
    const methods = new Set([...source.matchAll(/export (?:const|async function|function) (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]));
    for (const method of methods) {
      const kind = new RegExp(`export const ${method}\\s*=\\s*withAuth`).test(source) ? "withAuth"
        : new RegExp(`export const ${method}\\s*=\\s*monitoredCron`).test(source) ? "cron"
        : new RegExp(`export const ${method}\\s*=\\s*apiHandler`).test(source) ? "apiHandler"
        : "other";
      found.push({ route, method, kind, source });
    }
  }
  return found;
}

/** Handlers that are intentionally not behind withAuth, each with the control that protects it. */
const REVIEWED: Record<string, string> = {
  "/api/support/contact POST": "public form: same-origin check, honeypot, strict per-address rate limit",
  "/api/health GET": "uptime probe: coarse status only, no data",
  "/api/facility-reviews GET": "public ratings: published reviews only",
  "/api/payments/webhook/paystack POST": "gateway webhook: HMAC signature verified",
  "/api/profile-images/[...key] GET": "public avatars and logos: only images attached to an account",
  "/api/site-media/[...key] GET": "public facility site media",
  "/api/facility/break-glass POST": "own session check, active account required, audited",
  "/api/facility/break-glass DELETE": "own session check, active account required, audited",
  "/api/facility/break-glass GET": "own session check, active account required",
  "/api/facility/his/acceptance GET": "staging-only acceptance switch, refuses production",
  "/api/cron/credential-reminders POST": "x-cron-secret header",
  "/api/cron/credential-monitoring GET": "cron secret in header, read-only monitoring endpoint",
  "/api/cron/workspace GET": "cron secret inside the handler",
  "/api/ai-summary POST": "user session verified, AI safety checks enforced",
  "/api/ai-summary GET": "user session verified, AI safety checks enforced",
  "/api/lab-owner/team POST": "facility staff authorization required",
  "/api/lab-owner/team/[staffId]/credentials POST": "facility staff authorization required",
  "/api/lab-owner/team/[staffId]/credentials DELETE": "facility staff authorization required",
  "/api/lab-owner/team/[staffId]/permissions PUT": "facility staff authorization required",
  "/api/lab-owner/team/[staffId] PUT": "facility staff authorization required",
  "/api/lab-owner/team/[staffId] DELETE": "facility staff authorization required",
  "/api/lab-owner/team/reports GET": "facility staff authorization required, read-only reports",
};

const all = handlers();

describe("API route protection inventory", () => {
  it("finds the routes", () => {
    expect(all.length).toBeGreaterThan(300);
  });

  it("wraps almost every handler in withAuth", () => {
    expect(all.filter((h) => h.kind === "withAuth").length).toBeGreaterThan(400);
  });

  it("has no handler outside withAuth, cron or the reviewed list", () => {
    const unreviewed = all
      .filter((h) => h.kind !== "withAuth" && h.kind !== "cron")
      .filter((h) => !(`${h.route} ${h.method}` in REVIEWED))
      .map((h) => `${h.method} ${h.route}`);
    expect(unreviewed).toEqual([]);
  });

  it("keeps the reviewed list free of stale entries", () => {
    const present = new Set(all.map((h) => `${h.route} ${h.method}`));
    expect(Object.keys(REVIEWED).filter((k) => !present.has(k))).toEqual([]);
  });

  it("protects every cron route with a secret", () => {
    const crons = all.filter((h) => h.route.startsWith("/api/cron/"));
    expect(crons.length).toBeGreaterThan(5);
    for (const h of crons) expect(h.source, h.route).toMatch(/CRON_SECRET/);
  });

  it("does not leave state-changing public handlers beyond the reviewed ones", () => {
    const publicWrites = all.filter((h) => h.kind !== "withAuth" && h.kind !== "cron" && h.method !== "GET").map((h) => `${h.method} ${h.route}`);
    expect(publicWrites.sort()).toEqual([
      "DELETE /api/facility/break-glass",
      "DELETE /api/lab-owner/team/[staffId]",
      "DELETE /api/lab-owner/team/[staffId]/credentials",
      "POST /api/ai-summary",
      "POST /api/cron/credential-reminders",
      "POST /api/facility/break-glass",
      "POST /api/lab-owner/team",
      "POST /api/lab-owner/team/[staffId]/credentials",
      "POST /api/payments/webhook/paystack",
      "POST /api/support/contact",
      "PUT /api/lab-owner/team/[staffId]",
      "PUT /api/lab-owner/team/[staffId]/permissions",
    ]);
  });
});
