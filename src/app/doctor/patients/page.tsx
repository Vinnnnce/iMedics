import Link from "next/link";
import { Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { ageFromDob, formatDate, initials } from "@/lib/format";

export default async function DoctorPatientsPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const assignments = await prisma.patientAssignment.findMany({
    where: { doctorId: doctor.id, patient: { deletedAt: null } },
    orderBy: [{ status: "asc" }, { admittedAt: "desc" }],
    take: 200,
    include: { patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true, dateOfBirth: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">My Patients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Patients in your care</p>
        </div>
        <Link href="/patients/new">
          <Button className="bg-foreground text-background rounded-lg">
            <Plus className="h-4 w-4 mr-1" /> Add patient
          </Button>
        </Link>
      </div>

      {assignments.length === 0 && (
        <p className="text-sm text-muted-foreground">No patients yet. Patients appear here when you accept a booking or add them yourself.</p>
      )}

      <div className="space-y-3">
        {assignments.map(({ patient, status, admittedAt }) => {
          const name = `${patient.firstName} ${patient.lastName}`;
          return (
            <Card key={patient.id} className="beeline-card">
              <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/10 font-bold text-foreground">{initials(name)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{name}</p>
                      <Badge variant={status === "ACTIVE" ? "secondary" : "outline"} className="rounded-lg">
                        {status === "ACTIVE" ? "Active" : "Discharged"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Age {ageFromDob(patient.dateOfBirth)} — Case: {patient.caseNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">In your care since {formatDate(admittedAt)}</p>
                  </div>
                </div>
                <Link href={`/patients/${patient.id}`}>
                  <Button size="sm" variant="outline" className="rounded-lg">
                    View
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
