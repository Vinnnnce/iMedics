import { NextResponse, type NextRequest } from "next/server";
import { notFound } from "@/lib/errors";
import { SITE_IMAGE_MIME_TYPES, isSiteImageAttached, isValidFinalSiteImageKey, readSiteImage } from "@/lib/site-media";

/**
 * GET /api/site-media/[adminId]/[imageId] — stream an image attached to an ad,
 * news article or podcast episode. Public (these images appear on public pages)
 * but only final-prefix images that are attached to content are reachable;
 * unconfirmed uploads are not. PNG/JPEG/WEBP only, served with nosniff.
 */
export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  try {
    const parts = (await ctx.params).key ?? [];
    const s3Key = `site-media/${parts.join("/")}`;
    if (!isValidFinalSiteImageKey(s3Key)) throw notFound("Image not found");
    if (!(await isSiteImageAttached(s3Key))) throw notFound("Image not found");

    const { stream, contentType } = await readSiteImage(s3Key);
    if (!stream || !contentType || !SITE_IMAGE_MIME_TYPES.includes(contentType as never)) {
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
