import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runMedicationReminderSweep } from "@/lib/medication-reminders";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * GET /api/cron/medication-reminders — run every ~10 minutes by a scheduler
 * (Vercel Cron sends the CRON_SECRET as a bearer token). Materialises dose
 * events, sends due medication reminders and marks long-past doses as missed.
 * Idempotent: duplicate runs never double-send or double-create.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runMedicationReminderSweep();
  return NextResponse.json(result);
}
