import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { conflict } from "@/lib/errors";
import { UPLOAD_URL_TTL_SECONDS, presignUpload } from "@/lib/storage";
import { MAX_VERIFICATION_DOCUMENTS, newObjectKey, uploadRequestSchema } from "@/lib/uploads";

// POST /api/me/documents — step 1: presigned URL for a verification document (licence, certificate, ...).
// Available to professionals whose profile is awaiting verification (or was rejected).
export const POST = withAuth(null, async (req, { user }) => {
  const { mimeType, sizeBytes } = await parseBody(req, uploadRequestSchema);

  const [doctor, lab] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { userId: user.id }, select: { verificationStatus: true, documentKeys: true } }),
    prisma.labStaffProfile.findUnique({ where: { userId: user.id }, select: { verificationStatus: true, documentKeys: true } }),
  ]);
  const profile = doctor ?? lab;
  if (!profile) throw conflict("Complete your professional registration first");
  if (profile.verificationStatus === "VERIFIED") throw conflict("Your account is already verified");
  if (profile.documentKeys.length >= MAX_VERIFICATION_DOCUMENTS) throw conflict("Document limit reached");

  const key = newObjectKey(`verification/${user.id}`);
  const uploadUrl = await presignUpload(key, mimeType, sizeBytes);

  return NextResponse.json({
    key,
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": mimeType },
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });
}, { allowOnboarding: true });
