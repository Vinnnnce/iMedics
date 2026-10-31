import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { assertPatientLinked, requireHisAccess } from "@/lib/his/access";
import { requireUploadSession, MAX_PRESIGNED_PARTS } from "@/lib/his/media-multipart";
import { presignPartUpload, listUploadedParts, PART_URL_TTL_SECONDS } from "@/lib/storage";

const schema = z.object({
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(MAX_PRESIGNED_PARTS),
});

// POST /api/facility/his/media/multipart/[id]/parts — presign additional part
// uploads and report which parts storage already holds, so a retry after a
// dropped connection resumes instead of restarting the study.
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "UPLOAD_MEDIA", req);
  const { id } = await params;
  const session = await requireUploadSession(id, access);
  await assertPatientLinked(access.facility.id, session.patientId);
  const body = await parseBody(req, schema);
  const seen = new Set(body.partNumbers);
  if (seen.size !== body.partNumbers.length) throw badRequest("Duplicate part numbers were requested");
  for (const partNumber of body.partNumbers) {
    if (partNumber > session.partsTotal) throw badRequest(`This upload only has ${session.partsTotal} parts`);
  }
  const uploaded = await listUploadedParts(session.storageKey, session.s3UploadId);
  const urls = await Promise.all(body.partNumbers.map((partNumber) => presignPartUpload(session.storageKey, session.s3UploadId, partNumber)));
  return NextResponse.json({
    parts: urls.map((url, i) => ({ partNumber: body.partNumbers[i], url })),
    uploaded: uploaded.map((p) => ({ partNumber: p.partNumber, sizeBytes: p.sizeBytes })),
    session: { partSizeBytes: Number(session.partSizeBytes), partsTotal: session.partsTotal },
    expiresInSeconds: PART_URL_TTL_SECONDS,
  });
});
