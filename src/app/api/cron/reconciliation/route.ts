import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDailyReconciliation } from "@/lib/reconciliation";
import { retryFailedSubaccounts } from "@/lib/subaccounts";
import { processRefundQueue, recoverLateCancellationRefunds } from "@/lib/payments/service";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// GET /api/cron/reconciliation — run once a day by a scheduler (Vercel Cron sends CRON_SECRET as a
// bearer token). Compares yesterday's payment records with the gateway's report, persists every
// difference, alerts the admins, and retries subaccount provisioning that failed earlier.
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const yesterday = new Date(Date.now() - 86_400_000);
  const result = await runDailyReconciliation(yesterday);
  const refunds = await processRefundQueue().catch((error) => {
    console.error("Refund queue recovery failed:", error);
    return 0;
  });
  const lateRefunds = await recoverLateCancellationRefunds().catch((error) => {
    console.error("Late-cancellation refund recovery failed:", error);
    return 0;
  });
  const subaccounts = await retryFailedSubaccounts().catch((error) => {
    console.error("Subaccount retry failed:", error);
    return 0;
  });
  return NextResponse.json({ ...result, refundsRecovered: refunds, lateCancellationRefunds: lateRefunds, subaccountsRetried: subaccounts });
}
