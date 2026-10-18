import { Pill, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PrintButton } from "@/components/shared/print-button";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { formatDate } from "@/lib/format";
import { spectrumLabel } from "@/lib/prescriptions/reference";

export default async function PatientPrescriptionsPage() {
  const user = await requirePageRole("PATIENT");

  const prescriptions = await prisma.prescription.findMany({
    where: { patient: { userId: user.id, deletedAt: null } },
    orderBy: { issuedAt: "desc" },
    take: 50,
    include: { items: { orderBy: { sortOrder: "asc" } }, doctor: { select: { user: { select: { name: true } } } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Prescriptions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Medicines prescribed by your doctors</p>
        </div>
        <PrintButton label="Print prescriptions" />
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
            </div>
            {p.items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 border-b border-border/60 pb-3 text-sm last:border-0 last:pb-0">
                <Pill className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.drugName}{item.strength ? ` (${item.strength})` : ""}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      item.dose,
                      item.route,
                      item.frequencyText ?? item.frequency,
                      item.duration ? `for ${item.duration}` : null,
                      item.formulation,
                    ].filter(Boolean).join(" · ")}
                  </p>
                  {item.schedule.length > 0 && (
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      Times: {item.schedule.join(", ")}
                    </p>
                  )}
                  {item.antimicrobialSpectrum.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Coverage: {item.antimicrobialSpectrum.map(spectrumLabel).join(", ")}
                    </p>
                  )}
                  {item.indication && <p className="text-xs text-muted-foreground">For: {item.indication}</p>}
                  {item.foodInstructions && <p className="text-xs text-muted-foreground">{item.foodInstructions}</p>}
                  {item.missedDoseInstructions && (
                    <p className="text-xs text-muted-foreground">Missed dose: {item.missedDoseInstructions}</p>
                  )}
                  {item.monitoring && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /> {item.monitoring}
                    </p>
                  )}
                  {item.instructions && <p className="text-xs text-muted-foreground">{item.instructions}</p>}
                </div>
                {item.refills != null && item.refills > 0 && (
                  <Badge variant="outline" className="rounded-lg text-[10px]">{item.refills} refills</Badge>
                )}
              </div>
            ))}
            {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground print:hidden">
        Prescriptions shown here are issued by your verified doctors. Always follow the prescribing clinician&#x27;s instructions.
      </p>
    </div>
  );
}
