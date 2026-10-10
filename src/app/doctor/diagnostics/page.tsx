import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NoteForm } from "@/components/doctor/note-form";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { formatClinicDateTime } from "@/lib/format";

const TYPE_LABEL = { PROGRESS: "Progress note", ASSESSMENT: "Assessment", PLAN: "Plan" } as const;

export default async function DoctorClinicalNotesPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const [assignments, notes] = await Promise.all([
    prisma.patientAssignment.findMany({
      where: { doctorId: doctor.id, status: "ACTIVE", patient: { deletedAt: null } },
      include: { patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } } },
      take: 200,
    }),
    prisma.clinicalNote.findMany({
      where: { authorId: doctor.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { patient: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clinical Notes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Write progress notes and assessments. Only notes you choose to share are visible to the patient.</p>
      </div>

      <NoteForm patients={assignments.map((a) => ({ id: a.patient.id, name: `${a.patient.firstName} ${a.patient.lastName}`, caseNumber: a.patient.caseNumber }))} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Your recent notes</h2>
        {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        {notes.map((n) => (
          <Card key={n.id} className="beeline-card">
            <CardContent className="space-y-1 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">
                  {n.patient.firstName} {n.patient.lastName}
                </p>
                <Badge variant="outline" className="rounded-lg text-xs">{TYPE_LABEL[n.type]}</Badge>
                {n.visibleToPatient && <Badge variant="secondary" className="rounded-lg text-xs">Shared with patient</Badge>}
              </div>
              <p className="whitespace-pre-wrap">{n.content}</p>
              <p className="text-xs text-muted-foreground">{formatClinicDateTime(n.createdAt)}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
