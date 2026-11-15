import { badRequest } from "./errors";
import { deleteObject, getObjectStream, inspectObject, presignUpload, UPLOAD_URL_TTL_SECONDS } from "./storage";
import { newObjectKey } from "./uploads";

/**
 * Handwritten signature images for letterheads (mainly a doctor's personal
 * letterhead). Images live in private object storage; only the stored key is
 * kept on the letterhead, and every read goes through an authenticated route.
 */

/** Storage prefix for signature uploads — also gates which keys a letterhead may reference. */
export const SIGNATURE_KEY_PREFIX = "letterhead-signatures/";
export const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024; // 2 MB
export const SIGNATURE_MIME_TYPES = ["image/png", "image/jpeg"] as const;

const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** A key is a valid signature reference only inside the signature prefix. */
export function isSignatureKey(key: string): boolean {
  return key.startsWith(SIGNATURE_KEY_PREFIX) && key.length <= 500;
}

/** Presign a browser PUT for a new signature image. */
export async function presignSignatureUpload(mimeType: string, sizeBytes: number) {
  if (!(SIGNATURE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw badRequest("Signature image must be a PNG or JPEG");
  }
  if (sizeBytes < 1 || sizeBytes > MAX_SIGNATURE_BYTES) {
    throw badRequest("Signature image must be between 1 byte and 2 MB");
  }
  const key = newObjectKey(SIGNATURE_KEY_PREFIX.replace(/\/$/, ""));
  const uploadUrl = await presignUpload(key, mimeType, sizeBytes);
  return { key, uploadUrl, method: "PUT" as const, headers: { "Content-Type": mimeType }, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
}

/**
 * Verify a finished upload before it is attached to a letterhead: it must
 * exist, be within the size limit and actually be a PNG or JPEG. Invalid
 * uploads are deleted so nothing unusable is ever referenced.
 */
export async function verifySignatureUpload(key: string): Promise<{ sizeBytes: number; mimeType: "image/png" | "image/jpeg" }> {
  const { sizeBytes, head } = await inspectObject(key);
  if (sizeBytes > MAX_SIGNATURE_BYTES) {
    await deleteObject(key);
    throw badRequest("Signature image must be at most 2 MB");
  }
  if (!isPng(head) && !isJpeg(head)) {
    await deleteObject(key);
    throw badRequest("Signature image must be a PNG or JPEG file");
  }
  return { sizeBytes, mimeType: isPng(head) ? "image/png" : "image/jpeg" };
}

/** Stream a stored signature image for an authenticated preview. */
export async function readSignatureImageStream(key: string) {
  if (!isSignatureKey(key)) throw badRequest("Invalid signature image reference");
  return getObjectStream(key);
}

/**
 * Read a stored signature image into memory for PDF embedding. Returns null
 * when the image cannot be read (missing, too large or storage unavailable) —
 * documents must still render with a signature line, never fail because of it.
 */
export async function loadSignatureImageBytes(key: string | null | undefined): Promise<Uint8Array | null> {
  if (!key || !isSignatureKey(key)) return null;
  try {
    const { stream } = await getObjectStream(key);
    if (!stream) return null;
    const parts: Uint8Array[] = [];
    let total = 0;
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_SIGNATURE_BYTES) return null;
      parts.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return bytes.byteLength > 0 && (isPng(bytes) || isJpeg(bytes)) ? bytes : null;
  } catch {
    return null;
  }
}
