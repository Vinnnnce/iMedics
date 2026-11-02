import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/**
 * Legacy static demo pages (the original /lab-tests, /diagnostics and
 * /doctors/dashboard prototypes) have been replaced by the real, live-data
 * sections. These helpers send a visitor to the correct real section for
 * their role instead of showing them hardcoded mock data.
 */

/** Where lab tests and results live for each role. */
export async function redirectFromLegacyLabPage(): Promise<never> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  switch (user.role) {
    case "PATIENT":
      redirect("/patient/results");
    case "DOCTOR":
      redirect("/doctor/lab-requests");
    case "LAB_SCIENTIST":
      redirect("/lab/investigations");
    default:
      redirect("/");
  }
}

/** Where diagnostic records live for each role. */
export async function redirectFromLegacyDiagnosticsPage(): Promise<never> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  switch (user.role) {
    case "PATIENT":
      redirect("/patient/diagnostics");
    case "DOCTOR":
      redirect("/doctor/diagnostics");
    case "LAB_SCIENTIST":
      redirect("/lab/examinations");
    default:
      redirect("/");
  }
}

/** The old demo doctor dashboard — real one is /doctor/dashboard. */
export async function redirectFromLegacyDoctorDashboard(): Promise<never> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (user.role === "DOCTOR") redirect("/doctor/dashboard");
  redirect("/");
}
