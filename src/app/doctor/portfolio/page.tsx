import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/guards";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { PortfolioManager } from "@/components/doctor/portfolio-manager";

export default async function DoctorPortfolioPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getVerifiedDoctorProfile(user);
  if (!doctor) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your education, work history, publications, talks and case studies. Items stay private until you publish them.
        </p>
      </div>
      <PortfolioManager />
    </div>
  );
}
