import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ImedicsHomepage, type TopRatedDoctor, type TopRatedFacility } from "@/components/home/imedics-homepage";

export const metadata: Metadata = {
  title: "Medic1905 — Healthcare, all in one place",
  description:
    "Discover medical resources, explore healthcare services, and find the information you need to take your next step with confidence.",
};

/**
 * Top-rated doctors shown on the public homepage, from real published
 * reviews. Failures (e.g. database unavailable) degrade to an empty list —
 * the homepage still renders.
 */
async function getTopRatedDoctors(): Promise<TopRatedDoctor[]> {
  try {
    const doctors = await prisma.doctorProfile.findMany({
      where: {
        verificationStatus: "VERIFIED",
        ratingCount: { gt: 0 },
      },
      orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
      take: 4,
      select: {
        id: true,
        specialty: true,
        ratingAvg: true,
        ratingCount: true,
        user: { select: { name: true } },
      },
    });
    return doctors.map(doctor => ({
      id: doctor.id,
      name: doctor.user.name?.trim() || "Doctor",
      specialty: doctor.specialty,
      ratingAvg: doctor.ratingAvg,
      ratingCount: doctor.ratingCount,
    }));
  } catch {
    return [];
  }
}

/**
 * Top-rated facilities (hospitals, laboratories, diagnostic centres) shown on
 * the public homepage, from real published reviews. Failures degrade to an
 * empty list — the homepage still renders.
 */
async function getTopRatedFacilities(): Promise<TopRatedFacility[]> {
  try {
    const facilities = await prisma.labStaffProfile.findMany({
      where: {
        isPublished: true,
        verificationStatus: "VERIFIED",
        ratingCount: { gt: 0 },
      },
      orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
      take: 3,
      select: {
        id: true,
        laboratoryName: true,
        slug: true,
        ratingAvg: true,
        ratingCount: true,
        user: { select: { accountType: true } },
      },
    });
    return facilities
      .filter(facility => facility.user.accountType && facility.laboratoryName)
      .map(facility => ({
        id: facility.id,
        name: facility.laboratoryName as string,
        type: facility.user.accountType as TopRatedFacility["type"],
        slug: facility.slug,
        ratingAvg: facility.ratingAvg,
        ratingCount: facility.ratingCount,
      }));
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const user = await getCurrentUser();

  // Logged-out visitors get the public homepage; authenticated users keep the
  // existing role-based entry into the application, unchanged.
  if (!user) {
    const [topDoctors, topFacilities] = await Promise.all([
      getTopRatedDoctors(),
      getTopRatedFacilities(),
    ]);
    return <ImedicsHomepage topDoctors={topDoctors} topFacilities={topFacilities} />;
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
