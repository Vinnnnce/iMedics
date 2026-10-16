import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAccountBlocked, ROLE_POLICY } from "@/lib/roles";
import { SignOutButton } from "@/components/shared/sign-out-button";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  if (isAccountBlocked(user)) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Account unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account is unavailable. Please contact support if you believe this is a mistake.
        </p>
        <div className="mt-4"><SignOutButton /></div>
      </div>
    );
  }

  // New accounts (and professionals awaiting verification) continue in the registration flow.
  if (!user.onboardingComplete || user.status === "PENDING") redirect("/auth/callback");

  redirect(ROLE_POLICY[user.role].dashboard);
}
