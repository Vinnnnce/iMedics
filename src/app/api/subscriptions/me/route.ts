import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { entitlementsForPlan, getDoctorSubscription, listPlans, FREE_ENTITLEMENTS } from "@/lib/subscriptions";

// GET /api/subscriptions/me — the doctor's subscription, usage against their allowance, and entitlements.
export const GET = withAuth(["DOCTOR"], async (req, { user }) => {
  const subscription = await getDoctorSubscription(user.id);
  const plans = await listPlans();
  const active = subscription?.status === "ACTIVE" && subscription.currentPeriodEnd > new Date();

  return NextResponse.json({
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          planCode: subscription.plan.code,
          planName: subscription.plan.name,
          monthlyPrice: Number(subscription.plan.monthlyPrice),
          currency: subscription.plan.currency,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          consultationsUsed: subscription.consultationsUsed,
          consultationAllowance: subscription.plan.consultationAllowance,
          paymentStatus: subscription.payment?.status ?? null,
        }
      : null,
    entitlements: active && subscription ? entitlementsForPlan(subscription.plan) : { ...FREE_ENTITLEMENTS },
    plans: plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      monthlyPrice: Number(plan.monthlyPrice),
      currency: plan.currency,
      consultationAllowance: plan.consultationAllowance,
      features: entitlementsForPlan(plan),
    })),
  });
});
