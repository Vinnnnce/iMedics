import Link from "next/link";
import { Pill } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { formatDate } from "@/lib/format";

export default async function PatientPrescriptionsPage() {
  const user = await requirePageRole("PATIENT");

  const prescriptions = await prisma.prescription.findMany({
    where: { patient: { userId: user.id, deletedAt: null } },
    orderBy: { issuedAt: "desc" },
    take: 50,
    include: { items: true, doctor: { select: { user: { select: { name: true } } } }, case: { select: { id: true, caseNumber: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Prescriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Medicines prescribed by your doctors</p>
      </div>

      {prescriptions.length === 0 && <p className="text-sm text-muted-foreground">You have no prescriptions yet.</p>}

      {prescriptions.map((p) => (
        <Card key={p.id} className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {p.doctor.user.name} <span className="font-normal text-muted-foreground">— {formatDate(p.issuedAt)}</span>
              </p>
              <Badge variant={p.status === "ACTIVE" ? "secondary" : "outline"} className="rounded-lg">
                {p.status === "ACTIVE" ? "Active" : p.status === "EXPIRED" ? "Expired" : "Stopped"}
              </Badge>
              {p.case && (
                <Link href={`/patient/cases/${p.case.id}`}>
                  <Badge variant="outline" className="rounded-lg">{p.case.caseNumber}</Badge>
                </Link>
              )}
            </div>
            {p.items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 text-sm">
                <Pill className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{item.drugName}</p>
                  <p className="text-xs text-muted-foreground">{[item.dose, item.frequency, item.duration].filter(Boolean).join(" · ")}</p>
                  {item.instructions && <p className="text-xs text-muted-foreground">{item.instructions}</p>}
                </div>
              </div>
            ))}
            {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
