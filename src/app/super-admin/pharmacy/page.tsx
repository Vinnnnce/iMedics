import { Pill } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { moduleMode } from "@/lib/superadmin/policy-view";

export const dynamic = "force-dynamic";

export default async function PharmacyModulePage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "PHARMACY");
  const [medicationOrders, formularyItems, controlledEvents, purchaseOrders, mode] = await Promise.all([
    prisma.medicationOrder.count(),
    prisma.formularyItem.count(),
    prisma.controlledSubstanceEvent.count(),
    prisma.pharmacyPurchaseOrder.count(),
    moduleMode("PHARMACY"),
  ]);
  return <>
    <PageHeader title="Pharmacy Management" description="Medication orders, formularies and inventory across hospital and pharmacy modules" actions={<Badge variant={mode === "ENABLED" ? "default" : "secondary"}>{mode.toLowerCase().replaceAll("_", " ")}</Badge>} />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Medication orders" value={medicationOrders.toLocaleString()} />
      <StatCard label="Formulary items" value={formularyItems.toLocaleString()} />
      <StatCard label="Controlled-substance events" value={controlledEvents.toLocaleString()} />
      <StatCard label="Purchase orders" value={purchaseOrders.toLocaleString()} />
    </section>
    <Card className="beeline-card"><CardContent className="p-4 text-sm text-muted-foreground">
      <p className="flex items-center gap-2 font-medium text-foreground"><Pill className="size-4" />Prescribing boundary</p>
      <p className="mt-2">Medication orders are created and signed only by prescribing professionals with verified privileges. No administrative role — including the Super Admin — can prescribe, approve results or sign clinical documents. Module availability is <strong>{mode.toLowerCase().replaceAll("_", " ")}</strong>.</p>
    </CardContent></Card>
  </>;
}
