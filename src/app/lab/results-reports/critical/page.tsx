import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CriticalAlerts } from "@/components/investigations/facility/critical-alerts";
import { requireModulePageWithPermission } from "@/lib/modules/page-guards";

export default async function InvestigationCriticalAlertsPage() {
  await requireModulePageWithPermission("VERIFY_RESULTS", "HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE");
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 md:px-0">
      <Link href="/lab/results-reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Results &amp; Reports</Link>
      <div><h1 className="text-2xl font-bold">Critical result alerts</h1><p className="mt-1 text-sm text-muted-foreground">Who was notified, when, who acknowledged, and every escalation.</p></div>
      <CriticalAlerts />
    </div>
  );
}
