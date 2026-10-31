import { cache } from "react";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { permissionsForRole } from "@/lib/facility-staff";
import type { Me, MeFacility, MeResponse } from "@/lib/me-types";

/**
 * The user's facility context for navigation: their own facility profile, or
 * their first active staff membership. The server resolves the facility kind
 * and the membership role so the client can render module links without ever
 * making an authorization decision — every module page and API route still
 * enforces access server-side (see lib/guards.ts, lib/facility-auth.ts).
 */
async function facilityContext(
  userId: string,
  role: string,
  accountType: string | null,
): Promise<MeFacility | null> {
  if (role !== "PATIENT" && role !== "LAB_SCIENTIST") return null;
  const [ownProfile, membership] = await Promise.all([
    prisma.labStaffProfile.findUnique({
      where: { userId },
      select: { id: true, laboratoryName: true, kind: true },
    }),
    prisma.facilityStaff.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: {
        facilityRole: true,
        facility: { select: { id: true, laboratoryName: true, kind: true } },
      },
    }),
  ]);

  const facility = ownProfile ?? membership?.facility ?? null;
  if (!facility) return null;

  const kind =
    facility.kind ??
    (accountType === "HOSPITAL" || accountType === "LABORATORY" || accountType === "DIAGNOSTIC_CENTRE" || accountType === "PHARMACY"
      ? accountType
      : null);
  if (!kind) return null;

  const facilityRole = membership?.facilityRole ?? "OWNER";
  return {
    id: facility.id,
    name: facility.laboratoryName,
    kind,
    facilityRole,
    permissions: permissionsForRole(facilityRole),
  };
}

/**
 * Builds the full /api/me payload for a user. Used by the API route and by the
 * root layout, so the navigation is rendered with the right role on the very
 * first paint instead of waiting on a client-side fetch.
 */
export async function loadMe(user: User): Promise<MeResponse> {
  const [patient, doctor, lab, facility] = await Promise.all([
    user.role === "PATIENT"
      ? prisma.patient.findFirst({
          where: { userId: user.id, deletedAt: null },
          select: { id: true },
        })
      : null,
    user.role === "DOCTOR" || user.role === "PATIENT"
      ? prisma.doctorProfile.findUnique({
          where: { userId: user.id },
          select: { verificationStatus: true },
        })
      : null,
    user.role === "LAB_SCIENTIST" || user.role === "PATIENT"
      ? prisma.labStaffProfile.findUnique({
          where: { userId: user.id },
          select: { verificationStatus: true },
        })
      : null,
    facilityContext(user.id, user.role, user.accountType),
  ]);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    patientId: patient?.id ?? null,
    phone: user.phone,
    language: user.language,
    accountType: user.accountType,
    avatarUrl: user.avatarUrl,
    facility,
    onboardingComplete: user.onboardingComplete,
    verificationStatus: doctor?.verificationStatus ?? lab?.verificationStatus ?? null,
  };
}

/**
 * The navigation identity for the current request, or null when signed out
 * (or when the account is removed / suspended). Memoised per request. Failures
 * degrade to a signed-out navigation instead of breaking every page.
 */
export const getNavMe = cache(async (): Promise<Me | null> => {
  try {
    const user = await getCurrentUser();
    if (!user || user.deletedAt) return null;
    if (user.status === "SUSPENDED" || user.status === "BANNED") return null;
    return await loadMe(user);
  } catch {
    return null;
  }
});
