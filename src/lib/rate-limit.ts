import { createHash } from "node:crypto";
import { prisma } from "./prisma";
import { RateLimitError } from "./errors";
import { safeErrorMetadata } from "./safe-error";

export interface RateLimitPolicy {
  /** Short name of the protected action, e.g. "contact-form". Part of the counter key. */
  scope: string;
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
}

/** Shared presets. Tune here rather than at call sites. */
export const RATE_LIMITS = {
  publicForm: { scope: "public-form", limit: 5, windowSeconds: 10 * 60 },
  supportTicket: { scope: "support-ticket", limit: 10, windowSeconds: 60 * 60 },
  upload: { scope: "upload", limit: 30, windowSeconds: 60 * 60 },
  payment: { scope: "payment", limit: 10, windowSeconds: 60 },
  search: { scope: "search", limit: 60, windowSeconds: 60 },
  download: { scope: "download", limit: 120, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitPolicy>;

/**
 * Best-effort client address. On Vercel the platform sets x-forwarded-for; the first hop is the
 * client. The address is hashed before it is stored so counters never hold raw IPs.
 */
export function clientFingerprint(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

export function rateLimitKey(policy: RateLimitPolicy, identity: string, now = Date.now()): { key: string; windowEnd: number } {
  const windowMs = policy.windowSeconds * 1000;
  const index = Math.floor(now / windowMs);
  return { key: `${policy.scope}:${identity}:${index}`.slice(0, 200), windowEnd: (index + 1) * windowMs };
}

interface Options {
  /** When the counter store is unavailable: allow the request (default) or refuse it. */
  failOpen?: boolean;
  now?: number;
}

/**
 * Count one request against `identity` (a user id, or a client fingerprint for anonymous
 * callers) and throw a 429 once the window's limit is exceeded. The count is a single atomic
 * upsert, so concurrent serverless instances cannot under-count.
 */
export async function enforceRateLimit(policy: RateLimitPolicy, identity: string, options: Options = {}): Promise<void> {
  const now = options.now ?? Date.now();
  const { key, windowEnd } = rateLimitKey(policy, identity, now);
  let count: number;
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limit_buckets (key, count, expires_at)
      VALUES (${key}, 1, ${new Date(windowEnd + 60_000)})
      ON CONFLICT (key) DO UPDATE SET count = rate_limit_buckets.count + 1
      RETURNING count`;
    count = Number(rows[0]?.count ?? 1);
  } catch (error) {
    console.error("Rate limit store unavailable:", safeErrorMetadata(error));
    if (options.failOpen === false) throw new RateLimitError(30, "Service is busy. Please try again shortly.");
    return;
  }
  if (count > policy.limit) throw new RateLimitError((windowEnd - now) / 1000);
  // Housekeeping: about 1% of calls remove expired counters.
  if (Math.random() < 0.01) void purgeExpiredRateLimits();
}

export async function purgeExpiredRateLimits(): Promise<number> {
  try {
    const { count } = await prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return count;
  } catch (error) {
    console.error("Rate limit purge failed:", safeErrorMetadata(error));
    return 0;
  }
}

/** Rate limit an anonymous request by client address. */
export function enforceAnonymousRateLimit(policy: RateLimitPolicy, req: Request, options?: Options): Promise<void> {
  return enforceRateLimit(policy, `ip-${clientFingerprint(req)}`, options);
}
