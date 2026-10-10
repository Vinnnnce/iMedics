import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedLabProfile } from "@/lib/access";
import { conflict, notFound } from "@/lib/errors";
import { UPLOAD_URL_TTL_SECONDS, presignUpload } from "@/lib/storage";
import { newObjectKey, uploadRequestSchema } from "@/lib/uploads";

const MAX_FILES_PER_RESULT = 10;

// POST /api/labs/[id]/files — step 1 of an upload: ask for a presigned URL.
// The browser then PUTs the file straight to storage and calls /files/confirm.
export const POST = withAuth<{ id: string }>(["LAB_SCIENTIST"], async (req, { user, params }) => {
  const resultId = parseId((await params).id);
  await getVerifiedLabProfile(user);
  const { mimeType, sizeBytes } = await parseBody(req, uploadRequestSchema);

  const result = await prisma.labResult.findFirst({
    where: { id: resultId, uploadedById: user.id },
    select: { id: true, _count: { select: { files: true } } },
  });
  if (!result) throw notFound("Lab result not found");
  if (result._count.files >= MAX_FILES_PER_RESULT) throw conflict("This result already has the maximum number of files");

  const key = newObjectKey(`lab-results/${resultId}`);
  const uploadUrl = await presignUpload(key, mimeType, sizeBytes);

  return NextResponse.json({
    key,
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": mimeType },
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });
});
