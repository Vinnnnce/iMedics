import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { platformRevenueByMonth, providerEarnings, refundSummary, reportOverview, subscriptionUsageByPlan } from "@/lib/reports";

// GET /api/admin/reports — platform revenue, provider earnings, refunds, subscriptions and usage by plan.
export const GET = withAuth(["ADMIN"], async () => {
  const [overview, revenue, earnings, refunds, usageByPlan] = await Promise.all([
    reportOverview(),
    platformRevenueByMonth(),
    providerEarnings(),
    refundSummary(),
    subscriptionUsageByPlan(),
  ]);
  return NextResponse.json({ overview, revenue, earnings, refunds, usageByPlan });
});
