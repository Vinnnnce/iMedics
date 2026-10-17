import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { queueNotification } from "@/lib/notifications/service";

const dimensionSchema = z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional();

const verificationSchema = z.object({
  userId: z.string().uuid(),
  identityVerification: dimensionSchema,
  licenseVerification: dimensionSchema,
  qualificationVerification: dimensionSchema,
  licenseExpiry: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * PATCH /api/admin/verification — record an administrator's per-dimension verification decision
 * (identity, licence, qualifications) for a doctor. The doctor is notified of the change; the
 * evidence documents and this audit trail stay admin-only.
 */
export const PATCH = withAuth(["ADMIN"], async (req, { user: admin }) => {
  const data = await parseBody(req, verificationSchema);

  const doctor = await prisma.doctorProfile.findFirst({
    where: { userId: data.userId },
    select: { id: true, userId: true },
  });
  if (!doctor) throw notFound("Doctor profile not found");

  const now = new Date();
  const updated = await prisma.doctorProfile.update({
    where: { id: doctor.id },
    data: {
      ...(data.identityVerification ? { identityVerification: data.identityVerification, identityVerifiedAt: data.identityVerification === "VERIFIED" ? now : null } : {}),
      ...(data.licenseVerification ? { licenseVerification: data.licenseVerification, licenseVerifiedAt: data.licenseVerification === "VERIFIED" ? now : null } : {}),
      ...(data.qualificationVerification ? { qualificationVerification: data.qualificationVerification, qualificationVerifiedAt: data.qualificationVerification === "VERIFIED" ? now : null } : {}),
      ...(data.licenseExpiry !== undefined ? { licenseExpiry: data.licenseExpiry } : {}),
    },
    select: {
      identityVerification: true,
      identityVerifiedAt: true,
      licenseVerification: true,
      licenseVerifiedAt: true,
      qualificationVerification: true,
      qualificationVerifiedAt: true,
      licenseExpiry: true,
    },
  });

  await writeAudit({
    userId: admin.id,
    actorRole: admin.role,
    action: "ADMIN_DOCTOR_VERIFICATION",
    resourceType: "DoctorProfile",
    resourceId: doctor.id,
    details: {
      identityVerification: data.identityVerification ?? null,
      licenseVerification: data.licenseVerification ?? null,
      qualificationVerification: data.qualificationVerification ?? null,
      licenseExpiry: data.licenseExpiry ?? undefined,
      notes: data.notes ?? null,
    },
    req,
  });

  await queueNotification(doctor.userId, { kind: "VERIFICATION_UPDATED" });
  return NextResponse.json({ success: true, verification: updated });
});

// GET /api/admin/verification?userId= — the current per-dimension verification state for a doctor.
export const GET = withAuth(["ADMIN"], async (req) => {
  const userId = z.string().uuid().parse(new URL(req.url).searchParams.get("userId") ?? "");
  const doctor = await prisma.doctorProfile.findFirst({
    where: { userId },
    select: {
      identityVerification: true,
      identityVerifiedAt: true,
      licenseVerification: true,
      licenseVerifiedAt: true,
      qualificationVerification: true,
      qualificationVerifiedAt: true,
      licenseExpiry: true,
    },
  });
  if (!doctor) throw notFound("Doctor profile not found");
  const documentCount = await prisma.verificationDocument.count({ where: { userId } });
  return NextResponse.json({ verification: { ...doctor, documentCount } });
});
