import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CatalogueManager } from "@/components/investigations/facility/catalogue-manager";
import { requireModulePageWithPermission } from "@/lib/modules/page-guards";

export default async function FacilityInvestigationCataloguePage() {
  const { kind } = await requireModulePageWithPermission("MANAGE_SERVICES", "HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE");
  const domains = kind === "LABORATORY" ? (["LABORATORY"] as const) : kind === "DIAGNOSTIC_CENTRE" ? (["DIAGNOSTIC"] as const) : (["LABORATORY", "DIAGNOSTIC"] as const);
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 md:px-0">
      <Link href="/lab/results-reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Results &amp; Reports</Link>
      <div><h1 className="text-2xl font-bold">Investigation service catalogue</h1><p className="mt-1 text-sm text-muted-foreground">One central catalogue, your facility&apos;s view: choose what you offer, set prices and turnaround, and add services that are not yet listed.</p></div>
      <CatalogueManager domains={[...domains]} />
    </div>
  );
}
