import { NextResponse, type NextRequest } from "next/server";
import { monitoredCron } from "@/lib/monitoring";
import { timingSafeEqual } from "node:crypto";
import { escalateCriticalResultAlerts } from "@/lib/modules/critical-alert-escalation";
import { escalateInvestigationAlerts, notifyOverdueItems } from "@/lib/investigations/alerts";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// GET /api/cron/critical-alert-escalation — run every ~5 minutes by the platform
// scheduler. Escalates critical result alerts that have not been acknowledged
// within the response window (spec default 30 minutes) and re-notifies the
// responsible recipients, widening the audience at each escalation level.
// Overlapping runs are safe: alerts advance via conditional updates and an
// acknowledgement or resolution always wins the race.
async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await escalateCriticalResultAlerts();
  // Investigations platform: critical-result escalation and overdue-turnaround alerts.
  const investigations = await escalateInvestigationAlerts();
  const overdue = await notifyOverdueItems();
  return NextResponse.json({ ...summary, investigations, overdue });
}

export const GET = monitoredCron("critical-alert-escalation", run);
