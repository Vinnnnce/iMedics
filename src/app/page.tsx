import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  if (user.status === "SUSPENDED" || user.status === "BANNED") {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Account unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account has been suspended. Please contact support if you believe this is a mistake.
        </p>
      </div>
    );
  }

  // New accounts (and professionals awaiting verification) continue in the registration flow.
  if (!user.onboardingComplete || user.status === "PENDING") redirect("/auth/callback");

  switch (user.role) {
    case "ADMIN":
      redirect("/admin/dashboard");
    case "DOCTOR":
      redirect("/doctor/dashboard");
    case "LAB_SCIENTIST":
      redirect("/lab/dashboard");
    default:
      redirect("/dashboard");
  }
}
