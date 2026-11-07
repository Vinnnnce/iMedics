import { Plug } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { thirtyDaysAgo } from "@/lib/superadmin/windows";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "INTEGRATIONS");
  const [codeSystems, icd10Count, notifications30d, systemRelease] = await Promise.all([
    prisma.codeSystemRelease.findMany({ orderBy: { importedAt: "desc" }, take: 10, select: { system: true, edition: true, jurisdiction: true, importedAt: true, codeCount: true } }),
    prisma.icd10Code.count(),
    prisma.notification.count({ where: { createdAt: { gte: thirtyDaysAgo() } } }),
    prisma.codeSystemRelease.findFirst({ orderBy: { importedAt: "desc" }, select: { edition: true } }),
  ]);

  const integrations: [string, string, string][] = [
    ["HL7 FHIR", "Patient and clinical document exchange endpoints", "Supported"],
    ["DICOM / PACS", "Diagnostic imaging integrations", "Supported"],
    ["ICD-10 (WHO 2019)", `${icd10Count.toLocaleString()} diagnosis codes imported${systemRelease ? ` · release ${systemRelease.edition}` : ""}`, "Active"],
    ["RxNav / RxNorm", "Medication reference for structured prescriptions", "Active"],
    ["Paystack", "Payments, refunds and reconciliation", "Configured per environment"],
    ["Resend email", "Notification delivery", "Configured per environment"],
    ["Clerk", "Authentication and MFA", "Active"],
    ["Neon PostgreSQL", "Primary datastore with SSL pinned to verify-full", "Active"],
  ];

  return <>
    <PageHeader title="Integrations & API Management" description="Interoperability standards, code systems and third-party services" />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Code system releases" value={codeSystems.length.toLocaleString()} />
      <StatCard label="ICD-10 codes" value={icd10Count.toLocaleString()} />
      <StatCard label="Notifications (30 days)" value={notifications30d.toLocaleString()} />
      <StatCard label="Latest terminology release" value={systemRelease?.edition ?? "—"} />
    </section>
    <Card className="beeline-card">
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Plug className="size-4" />Integration register</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {integrations.map(([name, desc, status]) => <div key={name} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
          <div className="min-w-0"><p className="font-medium">{name}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
          <Badge variant="outline">{status}</Badge>
        </div>)}
      </CardContent>
    </Card>
    <Card className="beeline-card"><CardContent className="p-4 text-sm text-muted-foreground">
      <p>Standards supported where licensed and implemented locally: HL7 FHIR, DICOM, ICD-10, SNOMED CT, LOINC and UCUM. Code-system releases are versioned — records store a snapshot of the code and wording, so updating a list never rewrites past records.</p>
      <p className="mt-2">Sensitive infrastructure credentials, encryption keys and production secrets remain in secure infrastructure management systems — they are never displayed in dashboard screens.</p>
    </CardContent></Card>
  </>;
}
