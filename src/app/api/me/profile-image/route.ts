import { NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api";
import { presignUpload, UPLOAD_URL_TTL_SECONDS } from "@/lib/storage";
import {
  newStagingProfileImageKey,
  profileImageUploadRequestSchema,
} from "@/lib/profile-images";

// POST /api/me/profile-image — step 1: presigned URL for a profile photo or
// organisation logo. Onboarding is explicitly allowed: the image is uploaded
// during sign-up, before the account is complete or verified.
export const POST = withAuth(
  null,
  async (req, { user }) => {
    const { mimeType, sizeBytes } = await parseBody(
      req,
      profileImageUploadRequestSchema,
    );
    const key = newStagingProfileImageKey(user.id);
    const uploadUrl = await presignUpload(key, mimeType, sizeBytes);

    return NextResponse.json({
      key,
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": mimeType },
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });
  },
  { allowOnboarding: true },
);
