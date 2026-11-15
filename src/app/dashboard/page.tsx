import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardPage() {
  // Route to role-specific dashboards
  const current = await getCurrentUser();

  if (!current) {
    redirect("/auth/login");
  }

  if (current.role === "PATIENT") {
    redirect("/patient/dashboard");
  }

  if (current.role === "DOCTOR") {
    redirect("/doctor/dashboard");
  }

  if (current.role === "LAB_SCIENTIST") {
    redirect("/lab/dashboard");
  }

  if (current.role === "ADMIN") {
    redirect("/admin/dashboard");
  }

  redirect("/");
}

