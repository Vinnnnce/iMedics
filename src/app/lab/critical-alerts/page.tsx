import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AcknowledgeAlertButton } from "@/components/lab/critical-alerts";
import { requireModulePage } from "@/lib/modules/page-guards";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  SENT: "Awaiting acknowledgement",
  ACKNOWLEDGED: "Acknowledged",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
};

// Critical-result alerts (Module 01 Category 04 / Module 02 Category 04):
// hospitals acknowledge alerts for their orders; laboratories see the
// communication status of alerts raised on their results.
export default async function CriticalAlertsPage() {
  const { facilityId, kind } = await requireModulePage("HOSPITAL", "LABORATORY");

  const where =
    kind === "HOSPITAL"
      ? { orderingFacilityId: facilityId }
      : { labResult: { labOrder: { performingFacilityId: facilityId } } };

  const alerts = await prisma.criticalResultAlert.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      acknowledgedBy: { select: { name: true } },
      labResult: {
        select: {
          verifiedAt: true,
          labOrder: {
            select: {
              status: true,
              patient: { select: { firstName: true, lastName: true, caseNumber: true } },
            },
          },
        },
      },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Critical result alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Critical findings must be acknowledged by the responsible clinician.
          Unacknowledged alerts escalate after 30 minutes.
        </p>
      </div>

      {alerts.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" /> No critical-result alerts.
        </div>
      )}

      {alerts.map((a) => {
        const patient = a.labResult?.labOrder?.patient;
        return (
        <Card key={a.id} className={`beeline-card ${a.status === "SENT" ? "border-destructive/40" : ""}`}>
          <CardContent className="flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  {patient ? `${patient.firstName} ${patient.lastName}` : "Patient record unavailable"}
                </p>
                {patient && <Badge variant="outline" className="rounded-lg text-xs">{patient.caseNumber}</Badge>}
                <Badge variant={a.status === "SENT" ? "destructive" : "secondary"} className="rounded-lg text-xs">
                  {STATUS_LABEL[a.status]}
                </Badge>
                {a.escalationLevel > 0 && (
                  <Badge variant="destructive" className="rounded-lg text-xs">Escalation level {a.escalationLevel}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Raised {formatClinicDateTime(a.createdAt)}
                {a.labResult?.verifiedAt ? ` · verified ${formatClinicDateTime(a.labResult.verifiedAt)}` : ""}
                {a.acknowledgedAt
                  ? ` · acknowledged ${formatClinicDateTime(a.acknowledgedAt)}${a.acknowledgedBy ? ` by ${a.acknowledgedBy.name}` : ""}`
                  : ""}
              </p>
            </div>
            {kind === "HOSPITAL" && (a.status === "SENT" || a.status === "ESCALATED") && (
              <AcknowledgeAlertButton alertId={a.id} />
            )}
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}
