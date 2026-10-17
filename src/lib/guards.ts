import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "./auth";
import { prisma } from "./prisma";

/**
 * Server-side page guard for use in layouts and server pages.
 * Redirects unauthenticated, unregistered, suspended or wrong-role visitors.
 * API routes enforce the same rules independently (see lib/api.ts).
 */
export async function requirePageRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!user.onboardingComplete || user.status === "PENDING") redirect("/auth/callback");
  // "/" shows the account-unavailable notice for blocked users, or their own dashboard otherwise.
  if (user.status === "SUSPENDED" || user.status === "BANNED") redirect("/");
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

/** Page guard for facility owners and users with an active facility membership. */
export async function requireFacilityPortalPage() {
  const user = await requirePageRole("PATIENT", "LAB_SCIENTIST");
  if (user.role === "LAB_SCIENTIST") return user;

  const membership = await prisma.facilityStaff.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!membership) redirect("/");
  return user;
}

/** The doctor profile for a user id (one query per request). */
export const getDoctorProfile = cache((userId: string) => prisma.doctorProfile.findUnique({ where: { userId } }));

/** The clinical record linked to a patient account (one query per request). */
export const getPatientProfile = cache((userId: string) => prisma.patient.findFirst({ where: { userId, deletedAt: null } }));
