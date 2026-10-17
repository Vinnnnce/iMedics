import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { forbidden, notFound } from "@/lib/errors";
import { DOWNLOAD_URL_TTL_SECONDS, presignDownload } from "@/lib/storage";
import { portfolioItemIsPublic } from "@/lib/doctor-profile";
import { writeAudit } from "@/lib/audit";

// GET /api/doctor-files/[id] — download a doctor portfolio attachment.
// The owning doctor may always fetch it; anyone signed in may fetch it while the item is published
// (case studies only with recorded consent). Private items are reported as "not found".
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);

  const file = await prisma.doctorFile.findUnique({
    where: { id },
    select: { storageKey: true, fileName: true, doctorId: true, doctor: { select: { userId: true, verificationStatus: true, user: { select: { status: true, deletedAt: true } } } } },
  });
  if (!file) throw notFound("File not found");

  const isOwner = file.doctor.userId === user.id || user.role === "ADMIN";
  if (!isOwner) {
    if (file.doctor.verificationStatus !== "VERIFIED" || file.doctor.user.status !== "ACTIVE" || file.doctor.user.deletedAt) {
      throw notFound("File not found");
    }
    const item = await prisma.doctorPortfolioItem.findFirst({
      where: { attachmentFileId: id },
      select: { visibility: true, consentStatus: true, type: true },
    });
    if (!item || !portfolioItemIsPublic(item)) throw forbidden("This attachment has not been published");
  }

  const url = await presignDownload(file.storageKey, file.fileName);
  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_FILE_DOWNLOADED", resourceType: "DoctorFile", resourceId: id, req });

  return NextResponse.json({ url, fileName: file.fileName, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
});
