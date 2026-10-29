import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterSpecimenForm, SpecimenActions } from "@/components/lab/specimen-actions";
import { requireModulePage } from "@/lib/modules/page-guards";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  PENDING_COLLECTION: "Awaiting collection",
  COLLECTED: "Collected",
  RECEIVED: "Received",
  REJECTED: "Rejected",
  RECOLLECTION_REQUESTED: "Recollection requested",
  PROCESSED: "Processed",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING_COLLECTION: "secondary",
  COLLECTED: "secondary",
  RECEIVED: "default",
  REJECTED: "destructive",
  RECOLLECTION_REQUESTED: "destructive",
  PROCESSED: "outline",
};

// Laboratory Management — specimen work queue (Module 02, Category 02).
export default async function SpecimensPage() {
  const { facilityId } = await requireModulePage("LABORATORY");

  const specimens = await prisma.specimen.findMany({
    where: { facilityId },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      labOrder: {
        select: {
          id: true,
          status: true,
          priority: true,
          patient: { select: { firstName: true, lastName: true, caseNumber: true } },
          items: { select: { labTest: { select: { name: true } } } },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Specimens</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register, accession and track specimens; rejections require a documented reason.
        </p>
      </div>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Register a specimen</CardTitle></CardHeader>
        <CardContent><RegisterSpecimenForm /></CardContent>
      </Card>

      {specimens.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FlaskConical className="h-4 w-4" /> No specimens registered yet.
        </div>
      )}

      {specimens.map((s) => (
        <Card key={s.id} className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{s.accessionNumber}</p>
              <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"} className="rounded-lg text-xs">{STATUS_LABEL[s.status]}</Badge>
              {s.specimenType && <Badge variant="outline" className="rounded-lg text-xs">{s.specimenType}</Badge>}
              {s.labOrder.priority !== "ROUTINE" && (
                <Badge className="rounded-lg text-xs">{s.labOrder.priority === "STAT" ? "STAT" : "Urgent"}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {s.labOrder.patient.firstName} {s.labOrder.patient.lastName} · {s.labOrder.patient.caseNumber} ·{" "}
              {s.labOrder.items.map((i) => i.labTest.name).join(", ")}
            </p>
            <p className="text-xs text-muted-foreground">
              Registered {formatClinicDateTime(s.createdAt)}
              {s.collectedAt ? ` · collected ${formatClinicDateTime(s.collectedAt)}` : ""}
              {s.receivedAt ? ` · received ${formatClinicDateTime(s.receivedAt)}` : ""}
              {s.parentSpecimenId ? " · recollection" : ""}
            </p>
            {s.rejectionReason && (
              <p className="text-xs text-destructive">Rejection reason: {s.rejectionReason}</p>
            )}
            <SpecimenActions specimenId={s.id} status={s.status} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
