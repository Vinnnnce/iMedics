import { badRequest, forbidden, notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { HisAccess } from "./access";

/**
 * Resumable multipart configuration for large diagnostic uploads. Small files
 * keep the single-request presigned PUT path; only files at or above the
 * threshold open a multipart session, so a dropped connection retries the
 * missing parts instead of restarting the whole study.
 */

const MB = 1024 * 1024;

/** Files at or above this size use multipart transfer (default 64 MB). */
export function multipartThresholdBytes(): number {
  const raw = Number(process.env.HIS_MULTIPART_THRESHOLD_BYTES);
  return Number.isFinite(raw) && raw >= 8 * MB ? raw : 64 * MB;
}

/** Facility-wide diagnostic storage quota (default 20 GB). */
export function facilityMediaQuotaBytes(): number {
  const raw = Number(process.env.HIS_MEDIA_QUOTA_BYTES);
  return Number.isFinite(raw) && raw >= 512 * MB ? raw : 20 * 1024 * MB;
}

/** Parts of at least 8 MB so a 500 MB study needs at most ~63 requests, and a 4 TB study stays under the 10,000-part limit. */
export function partSizeBytesFor(sizeBytes: number): number {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1) throw badRequest("Invalid file size");
  if (sizeBytes <= 10_000 * 8 * MB) return 8 * MB;
  return Math.ceil(sizeBytes / 9_000 / MB) * MB;
}

export function partsTotalFor(sizeBytes: number, partSizeBytes: number): number {
  return Math.max(1, Math.ceil(sizeBytes / partSizeBytes));
}

/** Active upload sessions live at most a day; the cleanup job aborts the rest. */
export const UPLOAD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Never hand the browser more presigned part URLs than this per response. */
export const MAX_PRESIGNED_PARTS = 250;

/**
 * Refuse an upload that would push the facility past its diagnostic-storage
 * quota. Counts every non-deleted media object; the declared size is the
 * commitment being made, the verified size is checked again at confirmation.
 */
export async function assertFacilityMediaQuota(facilityId: string, additionalBytes: number): Promise<void> {
  const used = await prisma.medicalMedia.aggregate({ _sum: { sizeBytes: true }, where: { facilityId, deletedAt: null } });
  const usedBytes = Number(used._sum.sizeBytes ?? BigInt(0));
  if (usedBytes + additionalBytes > facilityMediaQuotaBytes()) {
    throw forbidden("This upload would exceed the facility's diagnostic-storage quota. Remove unneeded files or ask an administrator to raise the quota.");
  }
}

export type UploadSession = Awaited<ReturnType<typeof requireUploadSession>>;

/** Load an ACTIVE, unexpired session belonging to this facility, or explain why not. */
export async function requireUploadSession(sessionId: string, access: HisAccess) {
  const session = await prisma.medicalMediaUploadSession.findUnique({ where: { id: sessionId } });
  if (!session || session.facilityId !== access.facility.id) throw notFound("Upload session not found");
  if (session.status !== "ACTIVE") throw badRequest("This upload session is no longer active. Start the upload again.");
  if (session.expiresAt.getTime() < Date.now()) throw badRequest("This upload session expired. Start the upload again.");
  return session;
}

/**
 * Verify the parts the storage service actually holds against what a complete
 * transfer of the declared size requires: contiguous part numbers starting at 1,
 * every non-final part the full part size, and the total exactly the declared
 * size. Returns the parts to submit to CompleteMultipartUpload.
 */
export function verifyUploadedParts(
  parts: { partNumber: number; etag: string; sizeBytes: number }[],
  partsTotal: number,
  partSizeBytes: number,
  declaredSizeBytes: number,
): { partNumber: number; etag: string }[] {
  if (parts.length === 0) throw badRequest("No upload parts were received yet. Upload the file again.");
  const seen = new Set(parts.map((p) => p.partNumber));
  if (seen.size !== parts.length) throw badRequest("The storage service reported duplicate upload parts. Start the upload again.");
  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index].partNumber !== index + 1) {
      throw badRequest(`Upload part ${index + 1} is missing. Retry the file to resume the missing parts.`);
    }
  }
  if (sorted.length < partsTotal) {
    throw badRequest(`Upload is incomplete: ${sorted.length} of ${partsTotal} parts were received. Retry the file to resume the missing parts.`);
  }
  const partSize = Number(partSizeBytes);
  for (const part of sorted.slice(0, -1)) {
    if (part.sizeBytes !== partSize) throw badRequest("An upload part has an unexpected size. Retry the file.");
  }
  if (sorted[sorted.length - 1].sizeBytes < 1 || sorted[sorted.length - 1].sizeBytes > partSize) {
    throw badRequest("The final upload part has an unexpected size. Retry the file.");
  }
  const bytes = sorted.reduce((sum, part) => sum + part.sizeBytes, 0);
  if (bytes !== Number(declaredSizeBytes)) {
    throw badRequest("The uploaded parts do not total the declared file size. Retry the file.");
  }
  return sorted.map((p) => ({ partNumber: p.partNumber, etag: p.etag }));
}
