import { SearchCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateLabOrderDialog } from "@/components/lab/lab-order-forms";
import { requireModulePage } from "@/lib/modules/page-guards";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";
import Link from "next/link";

const LAB_STATUS: Record<string, string> = {
  ORDERED: "Sent to lab",
  ACCEPTED: "Accepted",
  SPECIMEN_PENDING: "Specimen pending",
  SPECIMEN_REJECTED: "Specimen rejected",
  IN_PROGRESS: "Processing",
  AWAITING_VERIFICATION: "Awaiting verification",
  FINALIZED: "Finalized",
  SENT_TO_FACILITY: "Report sent",
  AMENDED: "Amended",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const BOOKING_STATUS: Record<string, string> = {
  REQUESTED: "Referral sent",
  CONFIRMED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

// Hospital Management — investigation tracking across laboratory and
// diagnostics (Module 01, Category 04).
export default async function InvestigationsPage() {
  const { facilityId } = await requireModulePage("HOSPITAL");

  const [labOrders, referrals] = await Promise.all([
    prisma.labOrder.findMany({
      where: { requestingFacilityId: facilityId },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: {
        patient: { select: { firstName: true, lastName: true, caseNumber: true } },
        performingFacility: { select: { laboratoryName: true } },
        items: { select: { labTest: { select: { name: true } } } },
        specimens: { select: { accessionNumber: true, status: true } },
        results: {
          select: {
            id: true, status: true, verifiedAt: true,
            values: { select: { name: true, value: true, unit: true, flag: true } },
          },
        },
      },
    }),
    prisma.facilityBooking.findMany({
      where: { requestingFacilityId: facilityId },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      include: {
        patient: { select: { firstName: true, lastName: true, caseNumber: true } },
        service: { select: { facility: { select: { laboratoryName: true } } } },
        diagnosticReport: { select: { id: true, status: true, sentAt: true } },
      },
    }),
  ]);

  const pendingCritical = await prisma.criticalResultAlert.count({
    where: { orderingFacilityId: facilityId, status: { in: ["SENT", "ESCALATED"] } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Investigations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Laboratory orders and diagnostic referrals you requested, with their
              current status.{" "}
              {pendingCritical > 0 && (
                <Link href="/lab/critical-alerts" className="font-medium text-destructive hover:underline">
                  {pendingCritical} critical result{pendingCritical === 1 ? "" : "s"} awaiting acknowledgement
                </Link>
              )}
            </p>
          </div>
          <CreateLabOrderDialog />
        </div>
      </div>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Laboratory investigations</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {labOrders.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SearchCheck className="h-4 w-4" /> No laboratory orders yet.
            </div>
          )}
          {labOrders.map((o) => (
            <div key={o.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{o.patient.firstName} {o.patient.lastName}</p>
                <Badge variant="outline" className="rounded-lg text-xs">{o.patient.caseNumber}</Badge>
                <Badge variant="secondary" className="rounded-lg text-xs">{LAB_STATUS[o.status] ?? o.status}</Badge>
                {o.priority !== "ROUTINE" && <Badge className="rounded-lg text-xs">{o.priority === "STAT" ? "STAT" : "Urgent"}</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {o.items.map((i) => i.labTest.name).join(", ")}
                {o.performingFacility ? ` · ${o.performingFacility.laboratoryName}` : ""}
                {` · ordered ${formatClinicDateTime(o.createdAt)}`}
              </p>
              {o.specimens.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Specimens: {o.specimens.map((s) => `${s.accessionNumber} (${s.status.toLowerCase().replace(/_/g, " ")})`).join(", ")}
                </p>
              )}
              {o.results.filter((r) => r.status === "VERIFIED").map((result) => (
                <div key={result.id} className="mt-2 rounded-md bg-muted/50 p-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Result · {result.status.toLowerCase().replace(/_/g, " ")}
                    {result.verifiedAt ? ` · verified ${formatClinicDateTime(result.verifiedAt)}` : ""}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {result.values.map((v, i) => (
                      <li key={i} className="text-xs">
                        {v.name}: {v.value}
                        {v.unit ? ` ${v.unit}` : ""}
                        {v.flag && v.flag !== "NORMAL" && (
                          <span className="ml-1 font-semibold text-destructive">
                            {v.flag.toLowerCase().replace(/_/g, " ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Diagnostic referrals</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {referrals.length === 0 && <p className="text-sm text-muted-foreground">No diagnostic referrals yet.</p>}
          {referrals.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{r.patient.firstName} {r.patient.lastName}</p>
                <Badge variant="outline" className="rounded-lg text-xs">{r.patient.caseNumber}</Badge>
                <Badge variant="secondary" className="rounded-lg text-xs">
                  {r.diagnosticReport
                    ? `Report: ${(r.diagnosticReport.status ?? "").toLowerCase().replace(/_/g, " ")}`
                    : BOOKING_STATUS[r.status] ?? r.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.serviceName}
                {r.service?.facility ? ` · ${r.service.facility.laboratoryName}` : ""}
                {` · referred ${formatClinicDateTime(r.createdAt)}`}
              </p>
              {r.diagnosticReport && (
                <Link
                  href={`/lab/examinations/${r.diagnosticReport.id}`}
                  className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                >
                  View report →
                </Link>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
