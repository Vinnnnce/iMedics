import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ItemWorkspace } from "@/components/investigations/facility/item-workspace";
import { requireModulePageWithPermission } from "@/lib/modules/page-guards";
import { requireFacilityPortalPage } from "@/lib/guards";

interface Props { params: Promise<{ id: string }> }

export default async function InvestigationWorkspacePage({ params }: Props) {
  await requireModulePageWithPermission("PROCESS_ORDERS", "HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE");
  const user = await requireFacilityPortalPage();
  const { id } = await params;
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 md:px-0">
      <Link href="/lab/results-reports" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Results &amp; Reports</Link>
      <ItemWorkspace itemId={id} currentUserId={user.id} />
    </div>
  );
}
