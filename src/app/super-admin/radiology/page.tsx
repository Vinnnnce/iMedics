import { Scan } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { moduleMode } from "@/lib/superadmin/policy-view";

export const dynamic = "force-dynamic";

export default async function RadiologyModulePage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "RADIOLOGY");
  const [referrals, reports, signed, images, mode] = await Promise.all([
    prisma.facilityReferral.count(),
    prisma.diagnosticReport.count(),
    prisma.diagnosticReport.count({ where: { signedById: { not: null } } }),
    prisma.diagnosticImage.count(),
    moduleMode("DIAGNOSTICS"),
  ]);
  return <>
    <PageHeader title="Radiology & Diagnostics" description="Diagnostic referrals, reports and imaging across diagnostic centres and hospitals" actions={<Badge variant={mode === "ENABLED" ? "default" : "secondary"}>{mode.toLowerCase().replaceAll("_", " ")}</Badge>} />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Diagnostic referrals" value={referrals.toLocaleString()} />
      <StatCard label="Reports drafted" value={reports.toLocaleString()} />
      <StatCard label="Reports professionally signed" value={signed.toLocaleString()} />
      <StatCard label="Diagnostic images" value={images.toLocaleString()} />
    </section>
    <Card className="beeline-card"><CardContent className="p-4 text-sm text-muted-foreground">
      <p className="flex items-center gap-2 font-medium text-foreground"><Scan className="size-4" />Reporting boundary</p>
      <p className="mt-2">Diagnostic reports are signed only by authorised professionals. Module availability is <strong>{mode.toLowerCase().replaceAll("_", " ")}</strong> and enforced server-side.</p>
    </CardContent></Card>
  </>;
}
