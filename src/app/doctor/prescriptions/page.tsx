import { requirePageRole } from "@/lib/guards";
import { patientScope } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { DoctorPrescriptions } from "@/components/doctor/prescriptions";

export default async function DoctorPrescriptionsPage() {
  const user = await requirePageRole("DOCTOR");
  const { where } = await patientScope(user);
  const patients = await prisma.patient.findMany({
    where,
    orderBy: { lastName: "asc" },
    take: 200,
    select: { id: true, firstName: true, lastName: true },
  });
  return (
    <DoctorPrescriptions
      patients={patients.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim() }))}
    />
  );
}
