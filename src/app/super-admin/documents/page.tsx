import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { thirtyDaysAgo } from "@/lib/superadmin/windows";
import { latestPolicies } from "@/lib/superadmin/policy-view";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "DOCUMENTS");
  const monthAgo = thirtyDaysAgo();
  const [facilityTemplates, clinicalTemplates, documents30d, releasedToPatients, policies] = await Promise.all([
    prisma.facilityDocumentTemplate.count(),
    prisma.clinicalDocumentTemplate.count(),
    prisma.clinicalDocument.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.clinicalDocument.count({ where: { releasedToPatientAt: { not: null } } }),
    latestPolicies("DOCUMENT"),
  ]);

  return <>
    <PageHeader title="Medical Documents & Templates" description="Global template catalogue, document policies and release oversight" />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Active facility templates" value={facilityTemplates.toLocaleString()} />
      <StatCard label="Clinical document templates" value={clinicalTemplates.toLocaleString()} />
      <StatCard label="Documents created (30 days)" value={documents30d.toLocaleString()} />
      <StatCard label="Released to patients" value={releasedToPatients.toLocaleString()} />
    </section>
    <Card className="beeline-card"><CardContent className="space-y-4 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><FileText className="size-4" />Separation of document permissions</h2>
      <p className="text-sm text-muted-foreground">Every document template carries separate permissions for creating, editing, reviewing, approving, signing, releasing to patients, printing and downloading. A patient only ever receives documents explicitly approved and released for patient access.</p>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>Facilities customise permitted templates within the global catalogue</li>
        <li>Template changes are versioned; signed documents remain intact</li>
        <li>Outdated templates are archived, never rewritten</li>
        <li>Electronic signatures require an authorised professional signer</li>
      </ul>
      {policies.length > 0 && <div className="space-y-2">
        <p className="text-sm font-medium">Document policies in force</p>
        {policies.map((p) => <p key={p.id} className="rounded-lg border p-2 font-mono text-xs">{p.resource} · {p.mode.toLowerCase().replaceAll("_", " ")}</p>)}
      </div>}
      <Link href="/admin/control" className="inline-flex items-center gap-1 text-sm font-medium text-primary">Manage document policies in master control <ArrowRight className="size-3.5" /></Link>
    </CardContent></Card>
  </>;
}
