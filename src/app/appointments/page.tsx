import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// Appointments live in the role-specific portals.
export default async function AppointmentsIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  redirect(user.role === "DOCTOR" ? "/doctor/booking-requests" : user.role === "PATIENT" ? "/patient/appointments" : "/");
}
