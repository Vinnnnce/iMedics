import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sendDueAppointmentReminders } from "@/lib/reminders";
import { expireStalePayments } from "@/lib/payments/service";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// GET /api/cron/appointment-reminders — run every ~15 minutes by a scheduler (Vercel Cron sends the CRON_SECRET
// as a bearer token). Sends 24-hour and 1-hour reminders and releases slots held by unpaid bookings.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [reminders, expired] = await Promise.all([sendDueAppointmentReminders(), expireStalePayments()]);
  return NextResponse.json({ reminders, expiredBookings: expired });
}
