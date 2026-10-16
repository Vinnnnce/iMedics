import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getCurrentUser } from "./auth";
import { prisma } from "./prisma";
import { pageAccessRedirect } from "./roles";

/**
 * Server-side page guard for use in layouts and server pages.
 * Redirects unauthenticated, unregistered, suspended or wrong-role visitors.
 * API routes enforce the same rules independently (see lib/api.ts).
 */
export async function requirePageRole(...roles: Role[]) {
  const user = await getCurrentUser();
  const destination = pageAccessRedirect(user, roles);
  if (destination) redirect(destination);
  if (!user) redirect("/auth/login");
  return user;
}

/** The doctor profile for a user id (one query per request). */
export const getDoctorProfile = cache((userId: string) => prisma.doctorProfile.findUnique({ where: { userId } }));

/** The clinical record linked to a patient account (one query per request). */
export const getPatientProfile = cache((userId: string) => prisma.patient.findFirst({ where: { userId, deletedAt: null } }));
