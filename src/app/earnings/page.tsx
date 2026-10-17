import { EarningsView } from "@/components/shared/earnings-view";
import { requirePageRole } from "@/lib/guards";

export default async function EarningsPage() {
  await requirePageRole("DOCTOR", "LAB_SCIENTIST");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Earnings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your share of every settled charge, net of the platform commission, with refunds subtracted. Earnings are settled to
          your payout account.
        </p>
      </div>
      <EarningsView />
    </div>
  );
}
