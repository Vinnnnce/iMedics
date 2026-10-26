import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { DOWNLOAD_URL_TTL_SECONDS, presignDownload } from "@/lib/storage";

// GET /api/patient/media/[id] — short-lived download link for a released file of the patient's own record.
export const GET = withAuth<{ id: string }>(["PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const patient = await prisma.patient.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
  const media = patient ? await prisma.medicalMedia.findFirst({ where: { id, patientId: patient.id, deletedAt: null, releasedToPatientAt: { not: null } } }) : null;
  if (!media) throw notFound("File not found");
  const url = await presignDownload(media.storageKey, media.fileName);
  await writeAudit({ userId: user.id, actorRole: user.role, patientId: media.patientId, facilityId: media.facilityId, action: "PATIENT_MEDIA_DOWNLOADED", resourceType: "MedicalMedia", resourceId: media.id, req });
  return NextResponse.json({ url, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
});
