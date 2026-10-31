import { NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api";
import { presignUpload, UPLOAD_URL_TTL_SECONDS } from "@/lib/storage";
import { newStagingSiteImageKey, siteImageUploadSchema } from "@/lib/site-media";

// POST /api/admin/media — step 1: a presigned URL for an ad, news or podcast image (admin only).
export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const { mimeType, sizeBytes } = await parseBody(req, siteImageUploadSchema);
  const key = newStagingSiteImageKey(user.id);
  const uploadUrl = await presignUpload(key, mimeType, sizeBytes);
  return NextResponse.json({
    key,
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": mimeType },
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });
});
