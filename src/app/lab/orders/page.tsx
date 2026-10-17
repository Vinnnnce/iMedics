import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LabOrderActions } from "@/components/shared/lab-order-actions";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { ageFromDob, formatClinicDateTime } from "@/lib/format";
import { facilityPatientWhere } from "@/lib/facility-access";

export default async function LabOrdersPage() {
  const user = await requirePageRole("LAB_SCIENTIST");

  const orders = await prisma.labOrder.findMany({
    where: { patient: await facilityPatientWhere(user), status: { in: ["ORDERED", "IN_PROGRESS"] } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 100,
    include: {
      patient: { select: { firstName: true, lastName: true, caseNumber: true, dateOfBirth: true, gender: true } },
      orderedBy: { select: { name: true } },
      items: { include: { labTest: { select: { name: true } } } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Lab Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Open requests from doctors, most urgent first</p>
      </div>

      {orders.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="h-4 w-4" /> No open orders.
        </div>
      )}

      {orders.map((o) => (
        <Card key={o.id} className="beeline-card">
          <CardContent className="flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  {o.patient.firstName} {o.patient.lastName}
                </p>
                <Badge variant="outline" className="rounded-lg text-xs">{o.patient.caseNumber}</Badge>
                {o.priority !== "ROUTINE" && <Badge className="rounded-lg text-xs">{o.priority === "STAT" ? "STAT" : "Urgent"}</Badge>}
                <Badge variant="secondary" className="rounded-lg text-xs">{o.status === "ORDERED" ? "New" : "In progress"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {ageFromDob(o.patient.dateOfBirth)} y, {o.patient.gender.toLowerCase()} — requested by {o.orderedBy.name} on {formatClinicDateTime(o.createdAt)}
              </p>
              <p className="text-sm">{o.items.map((i) => i.labTest.name).join(", ")}</p>
              {o.clinicalNotes && <p className="text-xs text-muted-foreground">Note: {o.clinicalNotes}</p>}
            </div>
            <div className="flex items-center gap-2">
              {o.status === "ORDERED" && <LabOrderActions orderId={o.id} action="start" />}
              {o.status === "IN_PROGRESS" && (
                <Link href={`/lab/upload?orderId=${o.id}`}>
                  <Button size="sm" className="bg-foreground text-background rounded-lg">Enter results</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
