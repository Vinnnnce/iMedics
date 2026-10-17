import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processSubscriptionLifecycle, repairConsultationUsage, repairSubscriptionActivations } from "@/lib/subscriptions";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// GET /api/cron/subscriptions — run once a day by a scheduler (Vercel Cron sends CRON_SECRET as a
// bearer token). The managed renewal flow: lapse subscriptions whose period ended, cancel the ones
// the doctor asked to cancel, and send renewal and expiry notifications.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Sequential on purpose: each recovery pass must finish writing before the next pass (or the
  // lifecycle pass) reads, so the steps can never race on the same subscription or usage row.
  const repairedActivations = await repairSubscriptionActivations();
  const repairedUsage = await repairConsultationUsage();
  const result = await processSubscriptionLifecycle();
  return NextResponse.json({ ...result, repairedActivations, repairedUsage });
}
