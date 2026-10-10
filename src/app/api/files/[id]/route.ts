import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { DOWNLOAD_URL_TTL_SECONDS, presignDownload } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";

// GET /api/files/[id] — a short-lived download link for a lab result file.
// Access follows the lab result: the lab staff member who uploaded it, the patient it belongs to
// (never for rejected results), and doctors in that patient's care.
export const GET = withAuth<{ id: string }>(["DOCTOR", "PATIENT", "LAB_SCIENTIST"], async (req, { user, params }) => {
  const id = parseId((await params).id);

  const file = await prisma.labResultFile.findUnique({
    where: { id },
    include: { result: { select: { patientId: true, uploadedById: true, status: true } } },
  });
  if (!file) throw notFound("File not found");

  if (user.role === "LAB_SCIENTIST") {
    if (file.result.uploadedById !== user.id) throw notFound("File not found");
  } else {
    await findAccessiblePatient(user, file.result.patientId);
    if (user.role === "PATIENT" && file.result.status === "REJECTED") throw notFound("File not found");
  }

  const url = await presignDownload(file.storageKey, file.fileName);

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "LAB_FILE_DOWNLOADED",
    resourceType: "LabResultFile",
    resourceId: id,
    req,
  });

  return NextResponse.json({ url, fileName: file.fileName, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
});
