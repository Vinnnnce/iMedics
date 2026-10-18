import { NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import {
  finalizeProfileImage,
  isStagingProfileImageKey,
  profileImageConfirmSchema,
  publicProfileImageUrl,
} from "@/lib/profile-images";

// POST /api/me/profile-image/confirm — step 2: verify the uploaded image (magic
// bytes + size) and finalize it into a server-only key. Onboarding is explicitly
// allowed: the image is uploaded during sign-up.
export const POST = withAuth(
  null,
  async (req, { user }) => {
    const { key } = await parseBody(req, profileImageConfirmSchema);
    if (!isStagingProfileImageKey(key, user.id))
      throw badRequest("Invalid upload key");

    const finalKey = await finalizeProfileImage(key);
    return NextResponse.json(
      { key: finalKey, url: publicProfileImageUrl(finalKey) },
      { status: 201 },
    );
  },
  { allowOnboarding: true },
);
