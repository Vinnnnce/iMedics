import { redirectFromLegacyDoctorDashboard } from "@/lib/legacy-redirects";

/**
 * This route used to host a static demo doctor dashboard with hardcoded
 * data. The real doctor dashboard is /doctor/dashboard (live records).
 */
export default async function LegacyDoctorDashboardRedirect() {
  await redirectFromLegacyDoctorDashboard();
}
