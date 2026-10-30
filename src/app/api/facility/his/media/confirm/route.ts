import { withAuth, parseBody } from "@/lib/api";
import { requireHisAccess } from "@/lib/his/access";
import { confirmMediaSchema, mediaRecordedResponse, recordConfirmedMedia } from "@/lib/his/media-record";

export const runtime = "nodejs";

// POST /api/facility/his/media/confirm — step 2: verify the uploaded bytes and
// record the file against the correct patient (and encounter) with metadata.
// The multipart completion route shares the same verification tail.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "UPLOAD_MEDIA", req);
  const body = await parseBody(req, confirmMediaSchema);
  const mediaId = await recordConfirmedMedia(access, user, req, body);
  return mediaRecordedResponse(mediaId);
});
