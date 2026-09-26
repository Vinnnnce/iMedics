import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";

export default async function HomePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/auth/login");
  }

  const role = ((user.publicMetadata as Record<string, unknown>)?.role as string) ||
    ((user.unsafeMetadata as Record<string, unknown>)?.role as string) || "PATIENT";

  // Redirect based on role
  switch (role) {
    case "DOCTOR":
      redirect("/doctor/dashboard");
    case "LAB_SCIENTIST":
      redirect("/lab/dashboard");
    default:
      redirect("/dashboard");
  }
}
