import { badRequest } from "./errors";
import {
  deleteObject,
  getObjectStream,
  inspectObject,
  presignUpload,
  UPLOAD_URL_TTL_SECONDS,
} from "./storage";
import { newObjectKey } from "./uploads";

/**
 * Handwritten signature images for letterheads, mainly a doctor's personal
 * letterhead. Images live in private object storage; only the storage key is
 * retained on the letterhead, and every read goes through an authenticated
 * route.
 */

export const SIGNATURE_KEY_PREFIX = "letterhead-signatures/";
export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MIN_SIGNATURE_BYTES = 128;

export const SIGNATURE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
] as const;

export type SignatureMimeType = (typeof SIGNATURE_MIME_TYPES)[number];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47] as const;
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;

const MIME_BY_EXTENSION: Record<string, SignatureMimeType> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

const isPng = (bytes: Uint8Array): boolean =>
  bytes.length >= 4 &&
  bytes[0] === PNG_SIGNATURE[0] &&
  bytes[1] === PNG_SIGNATURE[1] &&
  bytes[2] === PNG_SIGNATURE[2] &&
  bytes[3] === PNG_SIGNATURE[3];

const isJpeg = (bytes: Uint8Array): boolean =>
  bytes.length >= 3 &&
  bytes[0] === JPEG_SIGNATURE[0] &&
  bytes[1] === JPEG_SIGNATURE[1] &&
  bytes[2] === JPEG_SIGNATURE[2];

const detectImageType = (
  bytes: Uint8Array,
): SignatureMimeType | null => {
  if (isPng(bytes)) return "image/png";
  if (isJpeg(bytes)) return "image/jpeg";
  return null;
};

const extensionOf = (key: string): string | null => {
  const match = /\.([a-zA-Z0-9]{1,8})$/.exec(key);
  return match?.[1]?.toLowerCase() ?? null;
};

/** A key is a valid signature reference only inside the signature prefix. */
export function isSignatureKey(key: string | null | undefined): boolean {
  if (!key) return false;

  return (
    key.startsWith(SIGNATURE_KEY_PREFIX) &&
    key.length <= 500 &&
    !key.includes("..") &&
    !key.includes("//") &&
    /^[\w./-]+$/.test(key)
  );
}

/** Keys are scoped to an owner so one user cannot reference another's image. */
export function isSignatureKeyForOwner(
  key: string | null | undefined,
  ownerId: string,
): boolean {
  if (!isSignatureKey(key) || !ownerId) return false;

  return key.startsWith(
    `${SIGNATURE_KEY_PREFIX}${ownerId}/`,
  );
}

/** Presign a browser PUT for a new signature image. */
export async function presignSignatureUpload(
  ownerId: string,
  mimeType: string,
  sizeBytes: number,
  fileExtension?: string | null,
): Promise<{
  key: string;
  uploadUrl: string;
  method: "PUT";
  headers: { "Content-Type": string };
  expiresInSeconds: number;
  maxBytes: number;
}> {
  if (!ownerId?.trim()) {
    throw badRequest("An authenticated owner is required");
  }

  if (
    !(SIGNATURE_MIME_TYPES as readonly string[]).includes(mimeType)
  ) {
    throw badRequest("Signature image must be a PNG or JPEG");
  }

  if (
    !Number.isInteger(sizeBytes) ||
    sizeBytes < MIN_SIGNATURE_BYTES ||
    sizeBytes > MAX_SIGNATURE_BYTES
  ) {
    throw badRequest(
      `Signature image must be between ${MIN_SIGNATURE_BYTES} bytes and 2 MB`,
    );
  }

  const extension =
    fileExtension && MIME_BY_EXTENSION[fileExtension.toLowerCase()]
      ? fileExtension.toLowerCase()
      : mimeType === "image/png"
        ? "png"
        : "jpg";

  const key = newObjectKey(
    `${SIGNATURE_KEY_PREFIX}${ownerId}`.replace(/\/+$/, ""),
    extension,
  );

  const uploadUrl = await presignUpload(key, mimeType, sizeBytes);

  return {
    key,
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": mimeType },
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    maxBytes: MAX_SIGNATURE_BYTES,
  };
}

export interface VerifiedSignatureUpload {
  key: string;
  sizeBytes: number;
  mimeType: SignatureMimeType;
  checksumSha256: string | null;
  width: number | null;
  height: number | null;
}

/**
 * Verify a completed upload before attaching it to a letterhead.
 *
 * The object must exist, be within the allowed size range, have an allowed
 * extension, and contain valid PNG or JPEG magic bytes. Invalid uploads are
 * deleted so unusable files are never referenced.
 */
export async function verifySignatureUpload(
  key: string,
  ownerId?: string,
): Promise<VerifiedSignatureUpload> {
  if (!isSignatureKey(key)) {
    throw badRequest("Invalid signature image reference");
  }

  if (ownerId && !isSignatureKeyForOwner(key, ownerId)) {
    throw badRequest("Signature image does not belong to this owner");
  }

  const extension = extensionOf(key);
  const expectedMime = extension
    ? MIME_BY_EXTENSION[extension]
    : undefined;

  if (!expectedMime) {
    await deleteObject(key);
    throw badRequest("Signature image must have a .png, .jpg, or .jpeg extension");
  }

  const inspection = await inspectObject(key);
  const { sizeBytes, head, checksumSha256, width, height } = inspection;

  if (sizeBytes < MIN_SIGNATURE_BYTES || sizeBytes > MAX_SIGNATURE_BYTES) {
    await deleteObject(key);
    throw badRequest(
      `Signature image must be between ${MIN_SIGNATURE_BYTES} bytes and 2 MB`,
    );
  }

  const detectedType = detectImageType(head);

  if (!detectedType || detectedType !== expectedMime) {
    await deleteObject(key);
    throw badRequest("Signature image contents must match a PNG or JPEG file");
  }

  return {
    key,
    sizeBytes,
    mimeType: detectedType,
    checksumSha256: checksumSha256 ?? null,
    width: width ?? null,
    height: height ?? null,
  };
}

/** Stream a stored signature image for an authenticated preview. */
export async function readSignatureImageStream(
  key: string,
  ownerId?: string,
) {
  if (!isSignatureKey(key)) {
    throw badRequest("Invalid signature image reference");
  }

  if (ownerId && !isSignatureKeyForOwner(key, ownerId)) {
    throw badRequest("Signature image does not belong to this owner");
  }

  return getObjectStream(key);
}

/**
 * Read a stored signature image into memory for PDF embedding.
 *
 * Returns `null` when the image cannot be read, is too large, has invalid
 * contents, or storage is unavailable. Documents must still render a signature
 * line rather than fail because a signature image could not be loaded.
 */
export async function loadSignatureImageBytes(
  key: string | null | undefined,
  ownerId?: string,
): Promise<Uint8Array | null> {
  if (!key || !isSignatureKey(key)) return null;

  if (ownerId && !isSignatureKeyForOwner(key, ownerId)) return null;

  try {
    const { stream } = await getObjectStream(key);
    if (!stream) return null;

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    const reader = stream.getReader();

    for (;;) {
      const { done, value } = await reader.read();

      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_SIGNATURE_BYTES) {
        await reader.cancel();
        return null;
      }

      chunks.push(value);
    }

    if (totalBytes < MIN_SIGNATURE_BYTES) return null;

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return detectImageType(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * Delete a signature image only when it belongs to the requesting owner.
 * Returns whether deletion was attempted; storage implementations may still
 * return an error for an object that no longer exists.
 */
export async function deleteSignatureImage(
  key: string | null | undefined,
  ownerId: string,
): Promise<boolean> {
  if (!key || !isSignatureKeyForOwner(key, ownerId)) return false;

  await deleteObject(key);
  return true;
}
