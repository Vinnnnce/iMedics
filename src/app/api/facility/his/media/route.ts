import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { badRequest, conflict } from "@/lib/errors";
import { assertPatientLinked, requireHisAccess } from "@/lib/his/access";
import { resolveFormat } from "@/lib/his/media-formats";
import { stagingPrefix } from "@/lib/his/media-storage";
import { assertFacilityMediaQuota, MAX_PRESIGNED_PARTS, multipartThresholdBytes, partSizeBytesFor, partsTotalFor, UPLOAD_SESSION_TTL_MS } from "@/lib/his/media-multipart";
import { createMultipartUpload, presignPartUpload, PART_URL_TTL_SECONDS, UPLOAD_URL_TTL_SECONDS, presignUpload, abortMultipartUpload } from "@/lib/storage";
import { newObjectKey } from "@/lib/uploads";
import { mediaVisibility } from "@/lib/his/visibility";

const presignSchema = z.object({
  patientId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  allowDuplicate: z.boolean().optional(),
});

const listSchema = z.object({ patientId: z.string().uuid().optional(), category: z.string().max(40).optional() });

// GET /api/facility/his/media — diagnostic media metadata for this hospital (downloads are issued per file).
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const q = parseQuery(req, listSchema);
  if (q.patientId) await assertPatientLinked(access.facility.id, q.patientId);
  const media = await prisma.medicalMedia.findMany({
    where: { facilityId: access.facility.id, deletedAt: null, ...mediaVisibility(access.permissions.includes("REVIEW_DOCUMENTS")), ...(q.patientId ? { patientId: q.patientId } : {}), ...(q.category ? { category: q.category as never } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, category: true, examinationType: true, examinationAt: true, fileName: true, formatKey: true, mimeType: true, sizeBytes: true,
      reportStatus: true, scanStatus: true, sensitivity: true, releasedToPatientAt: true, isTherapyRecord: true, createdAt: true, accessionNumber: true, modality: true, bodySite: true,
      patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true } },
      encounter: { select: { encounterNumber: true } },
    },
  });
  return NextResponse.json({ media: media.map((m) => ({ ...m, sizeBytes: Number(m.sizeBytes) })) });
});

// POST /api/facility/his/media — step 1: validate the declared file against the
// format registry and the facility storage quota, detect duplicates by
// checksum, and issue either a short-lived presigned PUT (small files) or a
// resumable multipart session (large studies) on a patient-scoped staging key.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "UPLOAD_MEDIA", req);
  const body = await parseBody(req, presignSchema);
  await assertPatientLinked(access.facility.id, body.patientId);
  const resolved = resolveFormat(body.fileName, body.mimeType);
  if ("error" in resolved) throw badRequest(resolved.error);
  if (body.sizeBytes > resolved.format.maxBytes) throw badRequest(`${resolved.format.label} files are limited to ${Math.round(resolved.format.maxBytes / 1048576)} MB`);

  await assertFacilityMediaQuota(access.facility.id, body.sizeBytes);

  const duplicate = await prisma.medicalMedia.findFirst({ where: { patientId: body.patientId, facilityId: access.facility.id, sha256: body.sha256.toLowerCase(), deletedAt: null }, select: { id: true, fileName: true } });
  if (duplicate && !body.allowDuplicate) throw conflict(`This exact file is already attached to the patient (${duplicate.fileName})`);

  const key = newObjectKey(stagingPrefix(access.facility.id, body.patientId).slice(0, -1));

  if (body.sizeBytes < multipartThresholdBytes()) {
    const uploadUrl = await presignUpload(key, body.mimeType, body.sizeBytes);
    return NextResponse.json({ mode: "SINGLE", key, uploadUrl, method: "PUT", headers: { "Content-Type": body.mimeType }, formatKey: resolved.format.key, expiresInSeconds: UPLOAD_URL_TTL_SECONDS });
  }

  // Large studies upload through resumable multipart parts so a dropped
  // connection retries only the missing parts.
  const s3UploadId = await createMultipartUpload(key, body.mimeType);
  const partSizeBytes = partSizeBytesFor(body.sizeBytes);
  const partsTotal = partsTotalFor(body.sizeBytes, partSizeBytes);
  let sessionId: string;
  try {
    const session = await prisma.medicalMediaUploadSession.create({
      data: {
        facilityId: access.facility.id, patientId: body.patientId, fileName: body.fileName, mimeType: body.mimeType, formatKey: resolved.format.key,
        declaredSizeBytes: BigInt(body.sizeBytes), declaredSha256: body.sha256.toLowerCase(), storageKey: key, s3UploadId,
        partSizeBytes: BigInt(partSizeBytes), partsTotal, uploadedById: user.id,
        status: "ACTIVE", expiresAt: new Date(Date.now() + UPLOAD_SESSION_TTL_MS),
      },
      select: { id: true },
    });
    sessionId = session.id;
  } catch (error) {
    // Never leave an orphaned multipart upload behind a failed session row.
    await abortMultipartUpload(key, s3UploadId);
    throw error;
  }
  const presigned = await Promise.all(
    Array.from({ length: Math.min(partsTotal, MAX_PRESIGNED_PARTS) }, (_, i) => presignPartUpload(key, s3UploadId, i + 1)),
  );
  return NextResponse.json({
    mode: "MULTIPART", key, s3UploadId, formatKey: resolved.format.key,
    session: { id: sessionId, partSizeBytes, partsTotal },
    parts: presigned.map((url, i) => ({ partNumber: i + 1, url })),
    expiresInSeconds: PART_URL_TTL_SECONDS,
  });
});
