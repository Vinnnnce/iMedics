import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ImedicsHomepage } from "@/components/home/imedics-homepage";
import { getHomepageData } from "@/lib/home/home-data";

export const metadata: Metadata = {
  title: "Medic1905 — Healthcare, all in one place",
  description:
    "Discover medical resources, explore healthcare services, and find the information you need to take your next step with confidence.",
};

export default async function HomePage() {
  const user = await getCurrentUser();

  // Logged-out visitors get the public homepage; authenticated users keep the
  // existing role-based entry into the application, unchanged.
  if (!user) {
    const home = await getHomepageData();
    return (
      <ImedicsHomepage
        topDoctors={home.topDoctors}
        topFacilities={home.topFacilities}
        carouselAds={home.carouselAds}
        bannerAd={home.bannerAd}
      />
    );
  }

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
      redirect("/admin");
    case "DOCTOR":
      redirect("/doctor/dashboard");
    case "LAB_SCIENTIST":
      redirect("/lab/dashboard");
    default:
      redirect("/dashboard");
  }
}
