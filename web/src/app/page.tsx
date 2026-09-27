import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

export default async function HomePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const role = ((user.publicMetadata as Record<string, unknown>)?.role as string) ||
    ((user.unsafeMetadata as Record<string, unknown>)?.role as string) || "PATIENT";

  // Admins land on the admin dashboard
  const adminEmails = ["medicmed26@gmail.com", "admin@medic1905.com", "vincentuzochi@gmail.com"];
  const isAdmin =
    role === "ADMIN" ||
    adminEmails.includes(user.emailAddresses?.[0]?.emailAddress || "");

  if (isAdmin) {
    redirect("/admin/dashboard");
  }

  switch (role) {
    case "DOCTOR":
      redirect("/doctor/dashboard");
    case "LAB_SCIENTIST":
      redirect("/lab/dashboard");
    default:
      redirect("/dashboard");
  }
}
