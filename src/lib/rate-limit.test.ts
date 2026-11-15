import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
const deleteMany = vi.fn();
vi.mock("./prisma", () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a), rateLimitBucket: { deleteMany: (...a: unknown[]) => deleteMany(...a) } } }));

import { RATE_LIMITS, clientFingerprint, enforceRateLimit, rateLimitKey } from "./rate-limit";
import { RateLimitError, toErrorResponse } from "./errors";

const policy = { scope: "test", limit: 3, windowSeconds: 60 };

beforeEach(() => { queryRaw.mockReset(); deleteMany.mockReset(); vi.spyOn(Math, "random").mockReturnValue(0.5); });

describe("rate limit keys", () => {
  it("is stable inside a window and changes in the next one", () => {
    const a = rateLimitKey(policy, "u1", 1_000_000);
    const b = rateLimitKey(policy, "u1", 1_000_000 + 10_000);
    const c = rateLimitKey(policy, "u1", 1_000_000 + 61_000);
    expect(a.key).toBe(b.key);
    expect(c.key).not.toBe(a.key);
    expect(a.windowEnd).toBeGreaterThan(1_000_000);
  });
  it("separates scopes and identities", () => {
    expect(rateLimitKey(policy, "u1", 5).key).not.toBe(rateLimitKey(policy, "u2", 5).key);
    expect(rateLimitKey({ ...policy, scope: "other" }, "u1", 5).key).not.toBe(rateLimitKey(policy, "u1", 5).key);
  });
  it("never stores a raw IP address", () => {
    const req = new Request("http://x.test", { headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" } });
    const fp = clientFingerprint(req);
    expect(fp).not.toContain("203");
    expect(fp).toHaveLength(24);
    expect(clientFingerprint(new Request("http://x.test", { headers: { "x-forwarded-for": "203.0.113.9" } }))).toBe(fp);
  });
});

describe("enforceRateLimit", () => {
  it("allows requests up to the limit", async () => {
    for (const n of [1, 2, 3]) {
      queryRaw.mockResolvedValueOnce([{ count: n }]);
      await expect(enforceRateLimit(policy, "u1")).resolves.toBeUndefined();
    }
  });
  it("rejects the request after the limit with a Retry-After hint", async () => {
    queryRaw.mockResolvedValueOnce([{ count: 4 }]);
    const now = 1_000_000;
    const error = await enforceRateLimit(policy, "u1", { now }).catch((e) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    const response = toErrorResponse(error);
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(Number(response.headers.get("Retry-After"))).toBeLessThanOrEqual(60);
  });
  it("fails open by default when the store is down, and closed on request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    queryRaw.mockRejectedValue(new Error("db down"));
    await expect(enforceRateLimit(policy, "u1")).resolves.toBeUndefined();
    await expect(enforceRateLimit(policy, "u1", { failOpen: false })).rejects.toBeInstanceOf(RateLimitError);
  });
  it("purges expired counters on a small share of calls", async () => {
    (Math.random as unknown as ReturnType<typeof vi.fn>).mockReturnValue(0.001);
    queryRaw.mockResolvedValueOnce([{ count: 1 }]);
    deleteMany.mockResolvedValue({ count: 2 });
    await enforceRateLimit(policy, "u1");
    await Promise.resolve();
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });
  it("has sane presets", () => {
    for (const p of Object.values(RATE_LIMITS)) { expect(p.limit).toBeGreaterThan(0); expect(p.windowSeconds).toBeGreaterThan(0); }
  });
});
