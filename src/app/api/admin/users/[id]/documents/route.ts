import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { DOWNLOAD_URL_TTL_SECONDS, presignDownload } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";

// GET /api/admin/users/[id]/documents — short-lived links to a professional's verification documents.
export const GET = withAuth<{ id: string }>(["ADMIN"], async (req, { user: admin, params }) => {
  const userId = parseId((await params).id);

  const [doctor, lab, records] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true } }),
    prisma.labStaffProfile.findUnique({ where: { userId }, select: { id: true } }),
    prisma.verificationDocument.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { fileName: true, key: true },
    }),
  ]);
  if (!doctor && !lab) throw notFound("No professional profile found for this user");

  const documents = await Promise.all(
    records.map(async (document) => ({
      name: document.fileName,
      url: await presignDownload(document.key, document.fileName),
    })),
  );

  await writeAudit({
    userId: admin.id,
    actorRole: admin.role,
    action: "ADMIN_VIEWED_VERIFICATION_DOCUMENTS",
    resourceType: "User",
    resourceId: userId,
    req,
  });

  return NextResponse.json({ documents, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
});
