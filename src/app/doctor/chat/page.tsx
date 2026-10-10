import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/shared/chat-panel";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";

export default async function DoctorChatPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const patients = await prisma.patientAssignment.findMany({
    where: { doctorId: doctor.id, status: "ACTIVE", patient: { deletedAt: null } },
    include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patient Chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Message patients who are in your care</p>
      </div>
      <ChatPanel startKey="patientId" contacts={patients.map((a) => ({ id: a.patient.id, name: `${a.patient.firstName} ${a.patient.lastName}` }))} />
    </div>
  );
}
