import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AssignmentActions } from "@/components/doctor/assignment-actions";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { formatDate } from "@/lib/format";

export default async function DoctorAdmitPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const assignments = await prisma.patientAssignment.findMany({
    where: { doctorId: doctor.id, patient: { deletedAt: null } },
    orderBy: { admittedAt: "desc" },
    take: 200,
    include: { patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } } },
  });

  const sections = [
    { title: "In your care", status: "ACTIVE" as const, empty: "No active patients." },
    { title: "Discharged", status: "DISCHARGED" as const, empty: "No discharged patients." },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Care Roster</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discharging a patient makes their record read-only for you. New patients join your roster when you accept a booking or add them.
        </p>
      </div>

      {sections.map((section) => {
        const rows = assignments.filter((a) => a.status === section.status);
        return (
          <section key={section.status} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {section.title} ({rows.length})
            </h2>
            {rows.length === 0 && <p className="text-sm text-muted-foreground">{section.empty}</p>}
            {rows.map(({ patient, admittedAt, dischargedAt }) => (
              <Card key={patient.id} className="beeline-card">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <Badge variant="outline" className="rounded-lg text-xs">
                        {patient.caseNumber}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Admitted {formatDate(admittedAt)}
                      {dischargedAt ? ` — discharged ${formatDate(dischargedAt)}` : ""}
                    </p>
                  </div>
                  <AssignmentActions patientId={patient.id} status={section.status} />
                </CardContent>
              </Card>
            ))}
          </section>
        );
      })}
    </div>
  );
}
