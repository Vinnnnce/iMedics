import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { latestPolicies } from "@/lib/superadmin/policy-view";

export const dynamic = "force-dynamic";

export default async function ClinicalGovernancePage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "GOVERNANCE");
  const [documentPolicies, pendingCredentials, approvedCredentials, clinicalPrivileges] = await Promise.all([
    latestPolicies("DOCUMENT"),
    prisma.staffCredential.count({ where: { verificationStatus: { in: ["UNVERIFIED", "PENDING_VERIFICATION"] } } }),
    prisma.staffCredential.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.clinicalPrivilege.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  const human = (s: string) => s.toLowerCase().replaceAll("_", " ");

  return <>
    <PageHeader title="Clinical Governance" description="Clinical standards, document access policies and professional verification" />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Document access policies" value={documentPolicies.length.toLocaleString()} href="/super-admin/documents" />
      <StatCard label="Credentials awaiting review" value={pendingCredentials.toLocaleString()} tone={pendingCredentials > 0 ? "warning" : undefined} href="/admin/control" />
      <StatCard label="Verified credentials" value={approvedCredentials.toLocaleString()} />
      <StatCard label="Active clinical privileges" value={clinicalPrivileges.toLocaleString()} />
    </section>
    <Card className="beeline-card"><CardContent className="space-y-4 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" />Document access policies</h2>
      {documentPolicies.map((p) => <article key={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold">{p.resource}</p>
          <p className="mt-1 text-xs text-muted-foreground">{p.reason}</p>
        </div>
        <Badge variant={p.mode === "ENABLED" ? "default" : "secondary"}>{human(p.mode)}</Badge>
      </article>)}
      {!documentPolicies.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No document restrictions published. Clinical documents follow facility privileges by default.</p>}
      <p className="text-xs text-muted-foreground">Clinical governance configures standards and templates; it does not open patient records. Clinical-record access remains separately authorised through facility privileges, time-boxed and audited.</p>
      <Link href="/admin/control" className="inline-flex items-center gap-1 text-sm font-medium text-primary">Review credentials in master control <ArrowRight className="size-3.5" /></Link>
    </CardContent></Card>
  </>;
}
