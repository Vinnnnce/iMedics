import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { DOWNLOAD_URL_TTL_SECONDS, presignDownload } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";

// GET /api/admin/users/[id]/documents — short-lived links to a professional's verification documents.
export const GET = withAuth<{ id: string }>(["ADMIN"], async (req, { user: admin, params }) => {
  const userId = parseId((await params).id);

  const [doctor, lab] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { userId }, select: { documentKeys: true } }),
    prisma.labStaffProfile.findUnique({ where: { userId }, select: { documentKeys: true } }),
  ]);
  const profile = doctor ?? lab;
  if (!profile) throw notFound("No professional profile found for this user");

  const documents = await Promise.all(
    profile.documentKeys.map(async (key, index) => ({
      name: `Document ${index + 1}`,
      url: await presignDownload(key, `verification-document-${index + 1}`),
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
