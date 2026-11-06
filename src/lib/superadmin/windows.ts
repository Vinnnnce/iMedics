/** Date-window helpers for console pages. Kept out of component bodies so
 * render stays pure; identical to the established overview-lib pattern. */

export function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 86400000);
}

export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function startOfCurrentYear(): Date {
  return new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
}

/** Round-trip database latency in milliseconds, measured outside render. */
export async function measureDatabaseLatency(): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const started = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return Date.now() - started;
}
