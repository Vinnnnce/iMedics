import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { DOWNLOAD_URL_TTL_SECONDS, presignDownload } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";

// GET /api/doctors/[id]/cv — a short-lived download link for a doctor's published CV.
// Only verified doctors' CVs are downloadable, and only the file the doctor attached to their profile.
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const doctorId = parseId((await params).id);

  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: doctorId, verificationStatus: "VERIFIED", user: { status: "ACTIVE", deletedAt: null } },
    select: { cvFileId: true, cvFile: { select: { storageKey: true, fileName: true } } },
  });
  if (!doctor || !doctor.cvFileId || !doctor.cvFile) throw notFound("No CV published");

  const url = await presignDownload(doctor.cvFile.storageKey, doctor.cvFile.fileName);
  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_CV_DOWNLOADED", resourceType: "DoctorFile", resourceId: doctor.cvFileId, req });

  return NextResponse.json({ url, fileName: doctor.cvFile.fileName, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
});
