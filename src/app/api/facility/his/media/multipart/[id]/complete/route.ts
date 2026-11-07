import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { assertPatientLinked, requireHisAccess } from "@/lib/his/access";
import { requireUploadSession, verifyUploadedParts } from "@/lib/his/media-multipart";
import { confirmMediaSchema, mediaRecordedResponse, recordConfirmedMedia } from "@/lib/his/media-record";
import { completeMultipartUpload, listUploadedParts, abortMultipartUpload } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

const schema = confirmMediaSchema.extend({
  // The client omits the staging key: the session owns it. The declared size
  // and checksum must match the session exactly.
  key: z.undefined().optional(),
  sizeBytes: z.number().int().min(1),
});

// POST /api/facility/his/media/multipart/[id]/complete — finish a resumable
// upload: complete the multipart object from the parts the storage service
// itself reports (never client ETags), then run the same verification and
// registration tail as the single-request confirmation path.
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "UPLOAD_MEDIA", req);
  const { id } = await params;
  const session = await requireUploadSession(id, access);
  await assertPatientLinked(access.facility.id, session.patientId);
  const body = await parseBody(req, schema);
  if (body.sizeBytes !== Number(session.declaredSizeBytes) || body.sha256.toLowerCase() !== session.declaredSha256) {
    throw badRequest("The file changed since the upload session started. Start the upload again.");
  }

  const uploaded = await listUploadedParts(session.storageKey, session.s3UploadId);
  const parts = verifyUploadedParts(uploaded, session.partsTotal, Number(session.partSizeBytes), Number(session.declaredSizeBytes));
  await completeMultipartUpload(session.storageKey, session.s3UploadId, parts);

  let mediaId: string;
  try {
    mediaId = await recordConfirmedMedia(access, user, req, { ...body, key: session.storageKey });
    await prisma.medicalMediaUploadSession.update({ where: { id: session.id }, data: { status: "COMPLETED" } });
  } catch (error) {
    // A failed verification removes the staging object itself; abort what
    // remains of the session so no orphaned parts survive.
    await abortMultipartUpload(session.storageKey, session.s3UploadId);
    await prisma.medicalMediaUploadSession.update({ where: { id: session.id }, data: { status: "ABANDONED" } }).catch(() => undefined);
    throw error;
  }
  return mediaRecordedResponse(mediaId);
});
