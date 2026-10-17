import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";

// GET /api/me — the signed-in user's authoritative role and onboarding state.
// The client uses this for routing; it must never trust Clerk metadata for that.
export const GET = withAuth(null, async (_req, { user }) => {
  const [patient, doctor, lab] = await Promise.all([
    user.role === "PATIENT"
      ? prisma.patient.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } })
      : null,
    prisma.doctorProfile.findUnique({ where: { userId: user.id }, select: { verificationStatus: true } }),
    prisma.labStaffProfile.findUnique({ where: { userId: user.id }, select: { verificationStatus: true } }),
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
    onboardingComplete: user.onboardingComplete,
    verificationStatus: doctor?.verificationStatus ?? lab?.verificationStatus ?? null,
  });
}, { allowOnboarding: true });

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    language: z.string().regex(/^[a-z]{2}$/, "Use a two-letter language code").optional(),
    // Patient self-service profile fields (no clinical data).
    preferredName: z.string().trim().min(1).max(120).nullable().optional(),
    bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).nullable().optional(),
    organDonorStatus: z.boolean().nullable().optional(),
    ecName: z.string().trim().max(120).nullable().optional(),
    ecRelationship: z.string().trim().max(120).nullable().optional(),
    ecPhone: z.string().trim().max(30).nullable().optional(),
    addressLine1: z.string().trim().max(200).nullable().optional(),
    addressLine2: z.string().trim().max(200).nullable().optional(),
    city: z.string().trim().max(120).nullable().optional(),
    state: z.string().trim().max(120).nullable().optional(),
    postalCode: z.string().trim().max(20).nullable().optional(),
    country: z.string().trim().max(2).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// PATCH /api/me — update your own display name, phone number or language.
// Patient users may also update self-service profile fields (preferred name,
// blood group, organ-donor status). Role, status and email cannot be changed
// here, and clinical records are never touched by this endpoint.
export const PATCH = withAuth(null, async (req, { user }) => {
  const data = await parseBody(req, updateSchema);
  const {
    preferredName, bloodGroup, organDonorStatus,
    ecName, ecRelationship, ecPhone,
    addressLine1, addressLine2, city, state, postalCode, country,
    ...userFields
  } = data;
  const patientFields = {
    preferredName, bloodGroup, organDonorStatus,
    ecName, ecRelationship, ecPhone,
    addressLine1, addressLine2, city, state, postalCode, country,
  };
  const hasPatientFields = Object.values(patientFields).some((v) => v !== undefined);

  const updated = await prisma.$transaction(async (tx) => {
    if (Object.keys(userFields).length > 0) {
      await tx.user.update({ where: { id: user.id }, data: userFields });
    }
    if (user.role === "PATIENT" && hasPatientFields) {
      await tx.patient.updateMany({
        where: { userId: user.id, deletedAt: null },
        data: Object.fromEntries(Object.entries(patientFields).filter(([, v]) => v !== undefined)),
      });
    }
    return tx.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        phone: true,
        language: true,
        patient: { select: { preferredName: true, bloodGroup: true, organDonorStatus: true } },
      },
    });
  });

  return NextResponse.json({
    name: updated?.name,
    phone: updated?.phone,
    language: updated?.language,
    preferredName: updated?.patient?.preferredName ?? null,
    bloodGroup: updated?.patient?.bloodGroup ?? null,
    organDonorStatus: updated?.patient?.organDonorStatus ?? null,
  });
});
