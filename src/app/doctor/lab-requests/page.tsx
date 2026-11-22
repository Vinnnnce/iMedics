import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DoctorHub } from "@/components/investigations/doctor-hub";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { formatClinicDateTime } from "@/lib/format";

const LEGACY_STATUS: Record<string, string> = { ORDERED: "Sent to lab", ACCEPTED: "Accepted", SPECIMEN_PENDING: "Specimen pending", SPECIMEN_REJECTED: "Specimen rejected", IN_PROGRESS: "Processing", AWAITING_VERIFICATION: "Awaiting verification", COMPLETED: "Completed", FINALIZED: "Finalized", SENT_TO_FACILITY: "Report sent", AMENDED: "Amended", CANCELLED: "Cancelled" };

// Results & Reports: choose Diagnostics or Laboratory Analysis, then track every order and report.
export default async function DoctorResultsAndReportsPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const [openCritical, legacy] = await Promise.all([
    prisma.investigation_critical_alerts.count({ where: { notifiedUserId: user.id, status: { in: ["SENT", "ESCALATED"] } } }),
    // Requests placed before the investigations catalogue existed stay visible (read-only).
    prisma.labOrder.findMany({ where: { orderedById: user.id }, orderBy: { createdAt: "desc" }, take: 10, include: { patient: { select: { firstName: true, lastName: true } }, items: { include: { labTest: { select: { name: true } } } } } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Results &amp; Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">What would you like to request for your patient?</p>
      </div>
      <DoctorHub openCriticalCount={openCritical} />

      {legacy.length > 0 && (
        <section className="space-y-2" aria-label="Earlier laboratory requests">
          <h2 className="text-sm font-semibold text-muted-foreground">Earlier laboratory requests</h2>
          {legacy.map((o) => (
            <Card key={o.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="text-sm font-medium">{o.patient.firstName} {o.patient.lastName} <Badge variant="secondary" className="ml-1">{LEGACY_STATUS[o.status] ?? o.status}</Badge></p>
                  <p className="text-xs text-muted-foreground">{o.items.map((i) => i.labTest.name).join(", ")} · {formatClinicDateTime(o.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
