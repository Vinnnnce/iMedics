import { NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { newObjectKey, uploadRequestSchema } from "@/lib/uploads";
import { UPLOAD_URL_TTL_SECONDS, presignUpload } from "@/lib/storage";

// POST /api/doctors/me/files — step 1: presigned URL for a doctor-owned file (CV, portfolio attachment).
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const { mimeType, sizeBytes } = await parseBody(req, uploadRequestSchema);

  const key = newObjectKey(`doctor-files/${doctor.id}`);
  const uploadUrl = await presignUpload(key, mimeType, sizeBytes);

  return NextResponse.json({
    key,
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": mimeType },
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });
});
