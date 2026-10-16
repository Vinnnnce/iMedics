import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/guards";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { ServiceManager } from "@/components/doctor/service-manager";

export default async function DoctorServicesPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getVerifiedDoctorProfile(user);
  if (!doctor) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Services and pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The services patients can book with you. Your standard consultation fee still applies to general bookings.
        </p>
      </div>
      <ServiceManager currency={doctor.currency} />
    </div>
  );
}
