import { ProvidersView } from "@/components/admin/providers-view";
import { requirePageRole } from "@/lib/guards";

export default async function AdminProvidersPage() {
  await requirePageRole("ADMIN");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Providers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verification and payouts: each provider&#39;s onboarding checklist, verification state and settlement subaccount.
          Verifying a provider automatically creates their payout subaccount once their bank details are in.
        </p>
      </div>
      <ProvidersView />
    </div>
  );
}
