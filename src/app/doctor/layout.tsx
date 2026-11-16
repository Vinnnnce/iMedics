import { Card, CardContent } from "@/components/ui/card";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { DoctorSidebar } from "@/components/doctor/doctor-sidebar";
import { DoctorTabNavigation } from "@/components/doctor/doctor-tab-navigation";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("DOCTOR");
  const profile = await getDoctorProfile(user.id);

  if (!profile || profile.verificationStatus !== "VERIFIED") {
    return (
      <Card className="beeline-card mx-auto max-w-md">
        <CardContent className="p-6 text-center">
          <h1 className="text-lg font-semibold">Verification required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your doctor profile has not been verified yet. You will get access to the doctor portal once an
            administrator has reviewed your credentials.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-screen flex-col md:flex-row">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <DoctorSidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Tab Navigation - hidden on desktop */}
        <DoctorTabNavigation />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
