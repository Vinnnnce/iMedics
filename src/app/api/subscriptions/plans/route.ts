import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { listPlans } from "@/lib/subscriptions";

// GET /api/subscriptions/plans — plans a doctor can pick, cheapest first.
export const GET = withAuth(null, async () => {
  const plans = await listPlans();
  return NextResponse.json({
    plans: plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      monthlyPrice: Number(plan.monthlyPrice),
      currency: plan.currency,
      consultationAllowance: plan.consultationAllowance,
      features: plan.features,
    })),
  });
});
