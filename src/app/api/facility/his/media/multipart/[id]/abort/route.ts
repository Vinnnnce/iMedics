import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { assertPatientLinked, requireHisAccess } from "@/lib/his/access";
import { requireUploadSession } from "@/lib/his/media-multipart";
import { abortMultipartUpload } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

// POST /api/facility/his/media/multipart/[id]/abort — abandon a resumable
// upload and delete its staged parts. The session keeps its audit history but
// can no longer be completed.
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "UPLOAD_MEDIA", req);
  const { id } = await params;
  const session = await requireUploadSession(id, access);
  await assertPatientLinked(access.facility.id, session.patientId);
  await abortMultipartUpload(session.storageKey, session.s3UploadId);
  await prisma.medicalMediaUploadSession.update({ where: { id: session.id }, data: { status: "ABANDONED" } });
  return NextResponse.json({ aborted: true });
});
