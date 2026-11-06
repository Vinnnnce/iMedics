import { Bot } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { thirtyDaysAgo } from "@/lib/superadmin/windows";
import { moduleMode } from "@/lib/superadmin/policy-view";

export const dynamic = "force-dynamic";

export default async function AiManagementPage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "AI");
  const monthAgo = thirtyDaysAgo();
  const [requests30d, byFeature, byStatus, reviews, mode] = await Promise.all([
    prisma.aiUsageLog.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.aiUsageLog.groupBy({ by: ["feature"], _count: { _all: true }, where: { createdAt: { gte: monthAgo } }, orderBy: { _count: { feature: "desc" } } }),
    prisma.aiUsageLog.groupBy({ by: ["status"], _count: { _all: true }, where: { createdAt: { gte: monthAgo } } }),
    prisma.aiAnalysis.count({ where: { reviewStatus: "PENDING_REVIEW" } }),
    moduleMode("AI"),
  ]);
  const human = (s: string) => s.toLowerCase().replaceAll("_", " ");
  const total = byFeature.reduce((a, f) => a + f._count._all, 0);

  return <>
    <PageHeader title="AI Management" description="AI capabilities, governance and usage across the platform" />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="AI requests (30 days)" value={requests30d.toLocaleString()} />
      <StatCard label="Features in use" value={byFeature.length.toLocaleString()} />
      <StatCard label="AI outputs awaiting review" value={reviews.toLocaleString()} tone={reviews > 0 ? "warning" : undefined} />
      <StatCard label="Errors (30 days)" value={(byStatus.find((s) => s.status === "ERROR")?._count._all ?? 0).toLocaleString()} />
    </section>
    <Card className="beeline-card">
      <CardHeader className="pb-2"><CardTitle className="text-base">Usage by feature (30 days)</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {byFeature.map((f) => <div key={f.feature} className="flex items-center gap-3 text-sm">
          <span className="w-40 shrink-0 truncate">{human(f.feature)}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground" style={{ width: `${total ? Math.round((f._count._all / total) * 100) : 0}%` }} /></div>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{f._count._all}</span>
        </div>)}
        {!byFeature.length && <p className="text-sm text-muted-foreground">No AI requests in the last 30 days.</p>}
      </CardContent>
    </Card>
    <Card className="beeline-card"><CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
      <p className="flex items-center gap-2 font-medium text-foreground"><Bot className="size-4" />AI governance</p>
      <p>The AI module is currently <strong>{mode.toLowerCase().replaceAll("_", " ")}</strong>. AI assists with documentation, drafting, interpretation support and operational analytics — it never independently diagnoses, prescribes, approves clinical results or signs clinical documents. Qualified professionals retain responsibility for every clinical decision, and AI-assisted documents are tracked to their reviewing professional.</p>
      <p>Restrict AI features by account type, facility or subscription, configure usage limits and require human review through module policies and the platform policy engine.</p>
    </CardContent></Card>
  </>;
}
