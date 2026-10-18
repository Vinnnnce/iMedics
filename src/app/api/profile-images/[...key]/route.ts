import { NextResponse, type NextRequest } from "next/server";
import { notFound } from "@/lib/errors";
import {
  PROFILE_IMAGE_MIME_TYPES,
  isProfileImageAttached,
  isValidFinalProfileImageS3Key,
  readProfileImage,
} from "@/lib/profile-images";

/**
 * GET /api/profile-images/[userId]/[imageId] — stream a doctor profile photo or
 * organisation logo that is attached to an account.
 *
 * Deliberately public (these images appear on public pages) but restricted to
 * final-prefix images that are attached to a User.avatarUrl or a
 * LabStaffProfile.logoUrl; unconfirmed uploads are not reachable. Content types
 * are limited to PNG/JPEG/WEBP and served with X-Content-Type-Options: nosniff.
 */
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> },
) {
  try {
    const parts = (await ctx.params).key ?? [];
    const s3Key = `profile-images/${parts.join("/")}`;
    if (!isValidFinalProfileImageS3Key(s3Key))
      throw notFound("Image not found");

    // Only serve images that are actually attached to an account.
    if (!(await isProfileImageAttached(s3Key)))
      throw notFound("Image not found");

    const { stream, contentType } = await readProfileImage(s3Key);
    if (
      !stream ||
      !contentType ||
      !PROFILE_IMAGE_MIME_TYPES.includes(contentType as never)
    ) {
      throw notFound("Image not found");
    }

    return new Response(stream, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
