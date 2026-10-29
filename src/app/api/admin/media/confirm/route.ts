import { NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import {
  finalizeSiteImage,
  isStagingSiteImageKey,
  publicSiteMediaUrl,
  siteImageConfirmSchema,
} from "@/lib/site-media";

// POST /api/admin/media/confirm — step 2: verify the uploaded image (magic bytes
// and size) and finalize it. Returns the URL to store on the ad, article or episode.
export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const { key } = await parseBody(req, siteImageConfirmSchema);
  if (!isStagingSiteImageKey(key, user.id)) throw badRequest("Invalid upload key");

  const finalKey = await finalizeSiteImage(key);
  const url = publicSiteMediaUrl(finalKey);
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "SiteMedia", resourceId: finalKey.split("/")[2], details: { uploaded: true }, req });
  return NextResponse.json({ key: finalKey, url }, { status: 201 });
});
