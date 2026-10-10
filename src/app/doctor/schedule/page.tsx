import { notFound } from "next/navigation";
import { ScheduleEditor } from "@/components/doctor/schedule-editor";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";

export default async function DoctorSchedulePage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const windows = await prisma.doctorSchedule.findMany({
    where: { doctorId: doctor.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    select: { dayOfWeek: true, startTime: true, endTime: true, slotMinutes: true },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Schedule Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Publish the weekly windows in which patients can book you</p>
      </div>
      <ScheduleEditor initial={windows} />
    </div>
  );
}
