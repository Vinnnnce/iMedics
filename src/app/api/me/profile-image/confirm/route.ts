import { NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import {
  finalizeProfileImage,
  isStagingProfileImageKey,
  profileImageConfirmSchema,
  publicProfileImageUrl,
} from "@/lib/profile-images";
import { prisma } from "@/lib/prisma";

// POST /api/me/profile-image/confirm — step 2: verify the uploaded image (magic
// bytes + size) and finalize it into a server-only key. Onboarding is explicitly
// allowed: the image is uploaded during sign-up. For a signed-in account it
// also attaches the image as the account's profile picture.
export const POST = withAuth(
  null,
  async (req, { user }) => {
    const { key } = await parseBody(req, profileImageConfirmSchema);
    if (!isStagingProfileImageKey(key, user.id))
      throw badRequest("Invalid upload key");

    const finalKey = await finalizeProfileImage(key);
    const url = publicProfileImageUrl(finalKey);

    // Attach to the caller's own account. The staging key is bound to this
    // user, so no other account can be modified here. finalizeProfileImage has
    // already verified the bytes; attaching also makes the image readable
    // through the public profile-image route.
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: url },
      select: { id: true },
    });

    return NextResponse.json({ key: finalKey, url }, { status: 201 });
  },
  { allowOnboarding: true },
);
