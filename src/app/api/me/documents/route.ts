import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { conflict } from "@/lib/errors";
import { UPLOAD_URL_TTL_SECONDS, presignUpload } from "@/lib/storage";
import { MAX_VERIFICATION_DOCUMENTS, newObjectKey, verificationUploadRequestSchema } from "@/lib/uploads";
import { findApplication } from "@/lib/verification";

// POST /api/me/documents — step 1: presigned URL for a verification document (licence, certificate, ...).
// Available to professionals whose application is awaiting review (or was rejected).
export const POST = withAuth(null, async (req, { user }) => {
  const { mimeType, sizeBytes } = await parseBody(req, verificationUploadRequestSchema);

  const application = await findApplication(user.id);
  if (!application) throw conflict("Complete your professional registration first");
  if (application.verificationStatus === "VERIFIED") throw conflict("Your account is already verified");
  const count = await prisma.verificationDocument.count({ where: { userId: user.id } });
  if (count >= MAX_VERIFICATION_DOCUMENTS) throw conflict("Document limit reached");

  const key = newObjectKey(`verification/${user.id}`);
  const uploadUrl = await presignUpload(key, mimeType, sizeBytes);

  return NextResponse.json({
    key,
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": mimeType },
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });
});
