import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { doctorProfileUpdateSchema, doctorSelfSelect } from "@/lib/doctor-profile";

// GET /api/doctors/me/profile — the signed-in doctor's professional profile (own view).
export const GET = withAuth(["DOCTOR"], async (_req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const profile = await prisma.doctorProfile.findUniqueOrThrow({
    where: { id: doctor.id },
    select: { ...doctorSelfSelect, cvFile: { select: { id: true, fileName: true } } },
  });
  return NextResponse.json({
    profile: {
      ...profile,
      licenseExpiry: profile.licenseExpiry?.toISOString() ?? null,
      cvFileName: profile.cvFile?.fileName ?? null,
      cvFile: undefined,
    },
  });
});

// PUT /api/doctors/me/profile — edit the professional profile fields the doctor owns.
// Verification dimensions, ratings and fees are managed elsewhere and cannot be set here.
// Turning the LinkedIn link on records the doctor's consent server-side, at that moment.
export const PUT = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const data = await parseBody(req, doctorProfileUpdateSchema);

  if (data.cvFileId) {
    const file = await prisma.doctorFile.findUnique({ where: { id: data.cvFileId }, select: { doctorId: true } });
    if (!file || file.doctorId !== doctor.id) throw badRequest("That CV file was not found among your uploads");
  }

  const profile = await prisma.$transaction(async (tx) => {
    const current = await tx.doctorProfile.findUniqueOrThrow({
      where: { id: doctor.id },
      select: { linkedinPublic: true, linkedinConsentAt: true },
    });
    const consentAt =
      data.linkedinPublic && data.linkedinUrl && !current.linkedinConsentAt ? new Date() : current.linkedinConsentAt;
    return tx.doctorProfile.update({
      where: { id: doctor.id },
      data: {
        ...data,
        licenseExpiry: data.licenseExpiry ?? null,
        // Consent is only recorded when the doctor turns the link on with a URL present.
        linkedinConsentAt: data.linkedinPublic && data.linkedinUrl ? consentAt : null,
        // A doctor cannot publish a LinkedIn link they have not consented to.
        linkedinPublic: data.linkedinPublic && Boolean(data.linkedinUrl) && Boolean(consentAt),
      },
      select: doctorSelfSelect,
    });
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "DOCTOR_PROFILE_UPDATED",
    resourceType: "DoctorProfile",
    resourceId: doctor.id,
    req,
  });

  return NextResponse.json({
    profile: { ...profile, licenseExpiry: profile.licenseExpiry?.toISOString() ?? null },
  });
});
