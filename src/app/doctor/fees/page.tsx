import { notFound } from "next/navigation";
import { FeeForm } from "@/components/doctor/fee-form";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";

export default async function DoctorFeesPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Fees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patients cannot book you until you publish a standard fee.
        </p>
      </div>
      <FeeForm
        initial={{
          consultationFee: doctor.consultationFee === null ? null : Number(doctor.consultationFee),
          followUpFee: doctor.followUpFee === null ? null : Number(doctor.followUpFee),
          followUpWindowDays: doctor.followUpWindowDays,
          currency: doctor.currency,
        }}
      />
    </div>
  );
}
