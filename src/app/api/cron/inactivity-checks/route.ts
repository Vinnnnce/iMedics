import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runInactivityChecks } from "@/lib/welfare";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * GET /api/cron/inactivity-checks — run every ~15 minutes by a scheduler
 * (Vercel Cron sends the CRON_SECRET as a bearer token). Checks every active
 * inactivity rule, triggers welfare alerts at the configured threshold and
 * escalates unacknowledged alerts. Idempotent per alert.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runInactivityChecks();
  return NextResponse.json(result);
}
