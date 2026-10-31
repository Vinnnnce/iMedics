import { PharmacyDashboard } from "@/components/his/pharmacy-dashboard";
import { requireHisPage } from "@/lib/his/page";

export default async function PharmacyPage() {
  const { can } = await requireHisPage("VIEW_PATIENT_DOCUMENTS", ["HOSPITAL", "PHARMACY"]);
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Pharmacy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Medication orders flow draft → submitted → reviewed → dispensed → completed. Allergies and this hospital’s own configured interaction rules are surfaced as advisory alerts — the system never invents rules, recommends dosing or integrates dispensing hardware.
        </p>
      </div>
      <PharmacyDashboard canOrder={can("ORDER_MEDICATIONS")} canReview={can("REVIEW_MEDICATIONS")} canManageFormulary={can("MANAGE_FORMULARY")} />
    </div>
  );
}
