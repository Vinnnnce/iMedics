import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { billingConfigured, getFacilityAccessState, graceDays, listFacilityPlans, SUBSCRIPTION_ENDED_MESSAGE } from "@/lib/facility-subscriptions";

// GET /api/facility/subscription — the facility's plan state, for the dashboard banner and billing page.
// Visible to every staff member of the facility; only the facility in the session is ever returned.
export const GET = withAuth(null, async (req, { user }) => {
  const { facility } = await requireFacilityAccess(user, null, req);
  const { state, subscription } = await getFacilityAccessState(facility.id);
  const [plans, configured] = await Promise.all([listFacilityPlans(), billingConfigured()]);
  return NextResponse.json({
    state: { phase: state.phase, canWrite: state.canWrite, endsAt: state.endsAt, daysLeft: state.daysLeft },
    subscription: subscription && {
      status: subscription.status, trialStartsAt: subscription.trialStartsAt, trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd, plan: subscription.plan,
    },
    plans, billingConfigured: configured, graceDays: graceDays(), endedMessage: SUBSCRIPTION_ENDED_MESSAGE,
  });
});
