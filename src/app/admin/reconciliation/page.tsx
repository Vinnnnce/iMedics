import { ReconciliationView } from "@/components/admin/reconciliation-view";
import { requirePageRole } from "@/lib/guards";

export default async function AdminReconciliationPage() {
  await requirePageRole("ADMIN");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Reconciliation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Daily comparison between Medic1905&#39;s payment records and the gateway&#39;s reports.
        </p>
      </div>
      <ReconciliationView />
    </div>
  );
}
