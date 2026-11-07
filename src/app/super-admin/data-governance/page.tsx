import { Database, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DataGovernancePage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "DATA_GOVERNANCE");
  const [patients, patientDocuments, clinicalDocuments, pendingExports] = await Promise.all([
    prisma.patient.count({ where: { deletedAt: null } }),
    prisma.patientDocument.count(),
    prisma.clinicalDocument.count(),
    prisma.approvalRequest.count({ where: { actionKey: "EXPORT_SENSITIVE_DATA", status: "PENDING" } }),
  ]);
  const settings = await prisma.platformSetting.findMany({ where: { OR: [{ key: { startsWith: "privacy." } }, { key: { startsWith: "backup." } }] }, select: { key: true, value: true } });
  const setting = (key: string) => settings.find((s) => s.key === key)?.value;

  return <>
    <PageHeader title="Data Governance" description="Retention, export policy, data quality and interoperability oversight" />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Active patient records" value={patients.toLocaleString()} />
      <StatCard label="Patient-uploaded documents" value={patientDocuments.toLocaleString()} />
      <StatCard label="Clinical documents" value={clinicalDocuments.toLocaleString()} />
      <StatCard label="Pending export approvals" value={pendingExports.toLocaleString()} tone={pendingExports > 0 ? "warning" : undefined} href="/super-admin/approvals" />
    </section>
    <Card className="beeline-card">
      <CardContent className="space-y-3 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold"><Database className="size-4" />Policies in force</p>
        <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
          <li>Data retention: {setting("privacy.dataRetentionDays") ? `${JSON.stringify(setting("privacy.dataRetentionDays"))} days (configured)` : "not configured — legal requirements apply by default"}</li>
          <li>Sensitive exports: {setting("privacy.exportRequiresApproval") === undefined ? "require an approved EXPORT_SENSITIVE_DATA request by default" : JSON.stringify(setting("privacy.exportRequiresApproval"))}</li>
          <li>Backup reference: {setting("backup.reference") ? String(setting("backup.reference")) : "recorded per release in the deployment environment"}</li>
          <li>Signed clinical documents are immutable — content corrections create new versions, never rewrites</li>
          <li>Deleted accounts are soft-deleted; clinical history is preserved</li>
        </ul>
        <p className="pt-2 text-muted-foreground">Data access requests, correction workflows and duplicate-patient detection run through the existing patient and facility modules; every data export is logged and, where required, approval-gated.</p>
        <Link href="/super-admin/settings" className="inline-flex items-center gap-1 font-medium text-primary">Configure retention and privacy settings <ArrowRight className="size-3.5" /></Link>
      </CardContent>
    </Card>
  </>;
}
