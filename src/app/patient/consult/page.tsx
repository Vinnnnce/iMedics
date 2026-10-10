import { Card, CardContent } from "@/components/ui/card";
import { ChatPanel } from "@/components/shared/chat-panel";
import { prisma } from "@/lib/prisma";
import { getPatientProfile, requirePageRole } from "@/lib/guards";
import { notFound } from "next/navigation";

export default async function PatientConsultPage() {
  const user = await requirePageRole("PATIENT");
  const patient = await getPatientProfile(user.id);
  if (!patient) notFound();

  const careTeam = await prisma.patientAssignment.findMany({
    where: { patientId: patient.id, status: "ACTIVE" },
    include: { doctor: { select: { id: true, user: { select: { name: true } } } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consultation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Message the doctors who are caring for you</p>
      </div>

      <Card className="beeline-card">
        <CardContent className="p-3 text-xs text-muted-foreground">
          Chat is for non-urgent questions. If you think you are having a medical emergency, contact your local emergency services or go to the nearest hospital.
          Video consultations are not available yet.
        </CardContent>
      </Card>

      <ChatPanel startKey="doctorId" contacts={careTeam.map((c) => ({ id: c.doctor.id, name: c.doctor.user.name }))} />
    </div>
  );
}
