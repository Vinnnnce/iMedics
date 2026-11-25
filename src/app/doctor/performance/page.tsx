import { Suspense } from "react";
import { requirePageRole } from "@/lib/guards";
import { DashboardView } from "@/components/analytics/dashboard-view";

// A doctor's own practice statistics. Drill-downs are not offered: patient lists stay in the consultation records.
export default async function DoctorPerformancePage() {
  await requirePageRole("DOCTOR");
  return (
    <div className="mx-auto max-w-[1200px] p-3 sm:p-6">
      <Suspense><DashboardView endpoint="/api/doctors/me/performance" dashboard="doctor-performance" initialTitle="My performance" /></Suspense>
    </div>
  );
}
