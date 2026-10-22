import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { permissionsForRole } from "@/lib/facility-staff";

/**
 * The user's facility context for navigation: their own facility profile, or
 * their first active staff membership. The server resolves the facility kind
 * and the membership role so the client can render module links without ever
 * making an authorization decision — every module page and API route still
 * enforces access server-side (see lib/guards.ts, lib/facility-auth.ts).
 */
async function facilityContext(userId: string, role: string, accountType: string | null) {
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
    (accountType === "HOSPITAL" || accountType === "LABORATORY" || accountType === "DIAGNOSTIC_CENTRE"
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

// GET /api/me — the signed-in user's authoritative role and onboarding state.
// The client uses this for routing; it must never trust Clerk metadata for that.
// Readable while onboarding: the signup wizard routes on this response.
export const GET = withAuth(
  null,
  async (_req, { user }) => {
    const [patient, doctor, lab, facility] = await Promise.all([
      user.role === "PATIENT"
        ? prisma.patient.findFirst({
            where: { userId: user.id, deletedAt: null },
            select: { id: true },
          })
        : null,
      prisma.doctorProfile.findUnique({
        where: { userId: user.id },
        select: { verificationStatus: true },
      }),
      prisma.labStaffProfile.findUnique({
        where: { userId: user.id },
        select: { verificationStatus: true },
      }),
      facilityContext(user.id, user.role, user.accountType),
    ]);

    return NextResponse.json({
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
      verificationStatus:
        doctor?.verificationStatus ?? lab?.verificationStatus ?? null,
    });
  },
  { allowOnboarding: true },
);

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    language: z
      .string()
      .regex(/^[a-z]{2}$/, "Use a two-letter language code")
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// PATCH /api/me — update your own display name, phone number or language.
// Role, status and email cannot be changed here.
export const PATCH = withAuth(null, async (req, { user }) => {
  const data = await parseBody(req, updateSchema);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { name: true, phone: true, language: true },
  });
  return NextResponse.json(updated);
});
