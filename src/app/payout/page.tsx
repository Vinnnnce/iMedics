import { PayoutSettingsForm } from "@/components/shared/payout-settings-form";
import { requirePageRole } from "@/lib/guards";

export default async function PayoutPage() {
  await requirePageRole("DOCTOR", "LAB_SCIENTIST");

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Payout settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Where your earnings from paid bookings are settled.</p>
      </div>
      <PayoutSettingsForm />
    </div>
  );
}
