import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LabOrderForm } from "@/components/doctor/lab-order-form";
import { LabOrderActions } from "@/components/shared/lab-order-actions";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { formatClinicDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = { ORDERED: "Sent to lab", ACCEPTED: "Accepted", SPECIMEN_PENDING: "Specimen pending", SPECIMEN_REJECTED: "Specimen rejected", IN_PROGRESS: "Processing", AWAITING_VERIFICATION: "Awaiting verification", COMPLETED: "Completed", FINALIZED: "Finalized", SENT_TO_FACILITY: "Report sent", AMENDED: "Amended", CANCELLED: "Cancelled" };

export default async function DoctorLabRequestsPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const [assignments, tests, orders] = await Promise.all([
    prisma.patientAssignment.findMany({
      where: { doctorId: doctor.id, status: "ACTIVE", patient: { deletedAt: null } },
      include: { patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } } },
      take: 200,
    }),
    prisma.labTest.findMany({ where: { isActive: true }, orderBy: [{ category: "asc" }, { name: "asc" }], select: { code: true, name: true, category: true } }),
    prisma.labOrder.findMany({
      where: { orderedById: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        items: { include: { labTest: { select: { name: true } } } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lab Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">Request tests for patients in your care</p>
      </div>

      <LabOrderForm
        patients={assignments.map((a) => ({ id: a.patient.id, name: `${a.patient.firstName} ${a.patient.lastName}`, caseNumber: a.patient.caseNumber }))}
        tests={tests}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Your recent requests</h2>
        {orders.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
        {orders.map((o) => (
          <Card key={o.id} className="beeline-card">
            <CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">
                    {o.patient.firstName} {o.patient.lastName}
                  </p>
                  <Badge variant="secondary" className="rounded-lg text-xs">{STATUS_LABEL[o.status]}</Badge>
                  {o.priority !== "ROUTINE" && <Badge className="rounded-lg text-xs">{o.priority === "STAT" ? "STAT" : "Urgent"}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{o.items.map((i) => i.labTest.name).join(", ")}</p>
                <p className="text-xs text-muted-foreground">{formatClinicDateTime(o.createdAt)}</p>
              </div>
              {o.status === "ORDERED" && <LabOrderActions orderId={o.id} action="cancel" />}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
