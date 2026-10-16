import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { doctorProfileUpdateSchema, doctorSelfSelect } from "@/lib/doctor-profile";

/** Serialize timestamps and drop the relation object from the own-view payload. */
function serialize(profile: Record<string, unknown>) {
  return {
    ...profile,
    licenseExpiry: profile.licenseExpiry instanceof Date ? (profile.licenseExpiry as Date).toISOString() : null,
  };
}

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
// A partial update: omitted fields keep their value. Verification dimensions, ratings and fees are
// managed elsewhere and cannot be set here. Turning the LinkedIn link on records the doctor's
// consent server-side, at that moment. Changing credential details (licensing, qualifications)
// returns the related verification dimension to PENDING for an administrator to re-check.
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
      select: {
        ...doctorSelfSelect,
        linkedinPublic: true,
        linkedinConsentAt: true,
        qualifications: true,
        licensingAuthority: true,
        licenseExpiry: true,
      },
    });

    // Consent is only recorded when the doctor turns the link on with a URL present.
    const consentAt =
      data.linkedinPublic === true && data.linkedinUrl !== null && data.linkedinUrl !== undefined && !current.linkedinConsentAt
        ? new Date()
        : current.linkedinConsentAt;
    const linkedinPublic = data.linkedinPublic === undefined ? current.linkedinPublic : data.linkedinPublic && Boolean(data.linkedinUrl) && Boolean(consentAt);
    const linkedinUrl = data.linkedinUrl === undefined ? current.linkedinUrl : data.linkedinUrl;

    // Credential changes send the related verification dimension back to PENDING.
    const dimensionReset: Record<string, unknown> = {};
    if (data.qualifications !== undefined && data.qualifications !== current.qualifications) {
      dimensionReset.qualificationVerification = "PENDING";
      dimensionReset.qualificationVerifiedAt = null;
    }
    const licensingChanged =
      (data.licensingAuthority !== undefined && data.licensingAuthority !== current.licensingAuthority) ||
      (data.licenseExpiry !== undefined && data.licenseExpiry?.getTime() !== current.licenseExpiry?.getTime());
    if (licensingChanged) {
      dimensionReset.licenseVerification = "PENDING";
      dimensionReset.licenseVerifiedAt = null;
    }

    return tx.doctorProfile.update({
      where: { id: doctor.id },
      data: {
        ...data,
        licenseExpiry: data.licenseExpiry === undefined ? undefined : data.licenseExpiry ?? null,
        linkedinUrl,
        linkedinPublic,
        linkedinConsentAt: linkedinPublic && linkedinUrl ? consentAt : null,
        ...dimensionReset,
      },
      select: { ...doctorSelfSelect, ...dimensionResetOnly(dimensionReset) },
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

  return NextResponse.json({ profile: serialize(profile) });
});

function dimensionResetOnly(reset: Record<string, unknown>) {
  const select: Record<string, true> = {};
  for (const key of Object.keys(reset)) select[key] = true;
  return select;
}
