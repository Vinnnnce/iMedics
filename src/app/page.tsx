import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAccountBlocked, ROLE_POLICY } from "@/lib/roles";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { PublicHomepage } from "@/components/home/public-homepage";

export const metadata: Metadata = {
  title: "Medic1905 — Quality healthcare, wherever you are",
  description:
    "Consult verified doctors, book laboratory tests, access diagnostic centres, and manage your health records securely on Medic1905.",
};

/**
 * Public marketing homepage for signed-out visitors. Signed-in users are routed
 * to their role dashboard exactly as before (blocked/pending accounts included).
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return <PublicHomepage />;

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