import { Microscope } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { moduleMode } from "@/lib/superadmin/policy-view";

export const dynamic = "force-dynamic";

export default async function LaboratoryModulePage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "LABORATORY");
  const [orders, resultsIssued, resultsVerified, specimens, mode] = await Promise.all([
    prisma.labOrder.count(),
    prisma.labResult.count(),
    prisma.labResult.count({ where: { verifiedById: { not: null } } }),
    prisma.specimen.count(),
    moduleMode("LABORATORY"),
  ]);
  return <>
    <PageHeader title="Laboratory Management" description="Specimen management, orders and results across all laboratories" actions={<Badge variant={mode === "ENABLED" ? "default" : "secondary"}>{mode.toLowerCase().replaceAll("_", " ")}</Badge>} />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Laboratory orders" value={orders.toLocaleString()} />
      <StatCard label="Results issued" value={resultsIssued.toLocaleString()} />
      <StatCard label="Results professionally verified" value={resultsVerified.toLocaleString()} />
      <StatCard label="Specimens tracked" value={specimens.toLocaleString()} />
    </section>
    <Card className="beeline-card"><CardContent className="p-4 text-sm text-muted-foreground">
      <p className="flex items-center gap-2 font-medium text-foreground"><Microscope className="size-4" />Verification boundary</p>
      <p className="mt-2">Laboratory results are approved and released only by qualified professionals through their facility privileges. Module availability is <strong>{mode.toLowerCase().replaceAll("_", " ")}</strong> and enforced server-side; administration of the module never includes authority over clinical findings.</p>
    </CardContent></Card>
  </>;
}
