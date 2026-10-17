import { CommissionManager } from "@/components/admin/commission-manager";
import { requirePageRole } from "@/lib/guards";

export default async function AdminCommissionPage() {
  await requirePageRole("ADMIN");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Commission configuration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set the platform commission per provider type (or per facility). The commission is snapshotted on each charge and
          settled by the gateway before the provider&#39;s share.
        </p>
      </div>
      <CommissionManager />
    </div>
  );
}
