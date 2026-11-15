import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Uptime probe for external monitors. Public by design, so it returns only coarse status and
 * latency: no versions, hostnames, counts or any patient data.
 */
export async function GET() {
  const started = Date.now();
  let database: "up" | "down" = "up";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }
  const ok = database === "up";
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", checks: { database }, latencyMs: Date.now() - started },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
