import Link from "next/link";
import { Blocks, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { MODULES } from "@/lib/platform/policy";
import { latestPolicies } from "@/lib/superadmin/policy-view";

export const dynamic = "force-dynamic";

export default async function ModuleControlPage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "MODULES");
  const policies = await latestPolicies("FEATURE");
  const modeFor = (resource: string) => policies.find((p) => p.resource === resource)?.mode ?? "ENABLED";
  const human = (s: string) => s.toLowerCase().replaceAll("_", " ");

  return <>
    <PageHeader title="Module & Feature Control" description="Master module availability across the platform, account types, plans, facilities, departments and users" />
    <Card className="beeline-card"><CardContent className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{policies.length} restriction polic{policies.length === 1 ? "y" : "ies"} active · defaults are enabled. Feature flags and staged rollouts use time-windowed policies so new features can be tested before platform-wide release.</p>
        <Link href="/admin/control" className="inline-flex items-center gap-1 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background">Open master control <ArrowRight className="size-3.5" /></Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <div key={m} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border bg-card p-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium"><Blocks className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{human(m)}</span></span>
            <Badge variant={modeFor(m) === "ENABLED" ? "default" : modeFor(m) === "DISABLED" ? "destructive" : "secondary"}>{human(modeFor(m))}</Badge>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Disabled modules cannot be accessed through direct URLs or APIs: the policy engine enforces availability on every request, intersecting with facility permissions and patient confidentiality. Signed clinical records are never deleted or rewritten by availability changes.</p>
    </CardContent></Card>
  </>;
}
