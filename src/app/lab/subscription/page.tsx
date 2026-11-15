import { SubscriptionManager } from "@/components/facility/subscription-manager";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser, requireFacilityAccess } from "@/lib/facility-auth";
import { billingConfigured, getFacilityAccessState, graceDays, listFacilityPlans } from "@/lib/facility-subscriptions";

export const dynamic = "force-dynamic";

export default async function FacilitySubscriptionPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);
  const [{ state, subscription }, plans, configured, owner] = await Promise.all([
    getFacilityAccessState(profile.id),
    listFacilityPlans(),
    billingConfigured(),
    requireFacilityAccess(user, "MANAGE_PAYOUTS").then(() => true, () => false),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscription</h1>
        <p className="text-sm text-muted-foreground">Your plan, trial and billing.</p>
      </div>
      <SubscriptionManager
        view={{
          phase: state.phase, canWrite: state.canWrite, daysLeft: state.daysLeft, endsAt: state.endsAt?.toISOString() ?? null,
          status: subscription?.status ?? null, trialEndsAt: subscription?.trialEndsAt.toISOString() ?? null,
          currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null, cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
          planName: subscription?.plan?.name ?? null, plans, billingConfigured: configured, canManage: owner, graceDays: graceDays(),
        }}
      />
    </div>
  );
}
