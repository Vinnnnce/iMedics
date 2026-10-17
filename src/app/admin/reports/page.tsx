import { ReportsView } from "@/components/admin/reports-view";
import { requirePageRole } from "@/lib/guards";

export default async function AdminReportsPage() {
  await requirePageRole("ADMIN");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform revenue, provider earnings, refunds, subscription revenue and usage by plan.
        </p>
      </div>
      <ReportsView />
    </div>
  );
}
