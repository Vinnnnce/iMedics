import { Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateReportDialog, EditDraftReportForm, ReportActions } from "@/components/lab/diagnostic-report-forms";
import { requireModulePage } from "@/lib/modules/page-guards";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  AWAITING_VERIFICATION: "Awaiting verification",
  FINALIZED: "Finalized",
  SENT: "Sent to hospital",
  AMENDED: "Amended",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary",
  AWAITING_VERIFICATION: "default",
  FINALIZED: "default",
  SENT: "outline",
  AMENDED: "destructive",
};

// Diagnostic Centre Management — examination and report work queue
// (Module 03, Categories 03 and 04).
export default async function ExaminationsPage() {
  const { facilityId } = await requireModulePage("DIAGNOSTIC_CENTRE");

  const bookings = await prisma.facilityBooking.findMany({
    where: { service: { facilityId }, status: { not: "CANCELLED" } },
    orderBy: [{ preferredAt: "desc" }],
    take: 100,
    include: {
      patient: { select: { firstName: true, lastName: true, caseNumber: true } },
      service: { select: { name: true, category: true } },
      diagnosticReport: true,
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Examinations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record examinations, draft reports, verify and sign them, and return
          them to the requesting hospital. Finalized reports are corrected only
          through traceable amendments.
        </p>
      </div>

      {bookings.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Stethoscope className="h-4 w-4" /> No examinations booked yet.
        </div>
      )}

      {bookings.map((b) => {
        const report = b.diagnosticReport;
        return (
          <Card key={b.id} className="beeline-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">{b.serviceName}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  {b.patient.firstName} {b.patient.lastName}
                </p>
                <Badge variant="outline" className="rounded-lg text-xs">{b.patient.caseNumber}</Badge>
                {report && (
                  <Badge variant={STATUS_VARIANT[report.status] ?? "secondary"} className="rounded-lg text-xs">
                    {STATUS_LABEL[report.status]}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Appointment {formatClinicDateTime(b.preferredAt)} · {b.workflowStage.toLowerCase().replace(/_/g, " ")}
              </p>
              {!report && <CreateReportDialog bookingId={b.id} serviceName={b.serviceName} />}
              {report && report.status === "DRAFT" && (
                <div className="space-y-3">
                  <EditDraftReportForm reportId={report.id} />
                </div>
              )}
              {report && <ReportActions reportId={report.id} status={report.status} />}
              {report && report.status === "AWAITING_VERIFICATION" && (
                <p className="text-xs text-muted-foreground">The report is ready for a verifying professional.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
