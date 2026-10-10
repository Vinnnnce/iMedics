import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedLabProfile } from "@/lib/access";
import { badRequest, notFound } from "@/lib/errors";
import { confirmUploadSchema, safeFileName, verifyUpload } from "@/lib/uploads";
import { writeAudit } from "@/lib/audit";

// POST /api/labs/[id]/files/confirm — step 2: check the uploaded object and attach it to the result.
export const POST = withAuth<{ id: string }>(["LAB_SCIENTIST"], async (req, { user, params }) => {
  const resultId = parseId((await params).id);
  await getVerifiedLabProfile(user);
  const { key, fileName, mimeType } = await parseBody(req, confirmUploadSchema);

  // The key must have been issued for this very result.
  if (!key.startsWith(`lab-results/${resultId}/`)) throw badRequest("Invalid upload key");

  const result = await prisma.labResult.findFirst({
    where: { id: resultId, uploadedById: user.id },
    select: { id: true },
  });
  if (!result) throw notFound("Lab result not found");

  const { sizeBytes } = await verifyUpload(key, mimeType);

  const file = await prisma.labResultFile.create({
    data: { resultId, storageKey: key, fileName: safeFileName(fileName), mimeType, sizeBytes },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "LAB_FILE_ATTACHED",
    resourceType: "LabResult",
    resourceId: resultId,
    details: { fileId: file.id },
    req,
  });

  return NextResponse.json({ file }, { status: 201 });
});
