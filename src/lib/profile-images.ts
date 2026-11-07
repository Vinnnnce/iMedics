import { randomUUID } from "node:crypto";
import { z } from "zod";
import { badRequest } from "./errors";
import {
  copyObject,
  deleteObject,
  inspectObject,
  getObjectStream,
} from "./storage";
import { newObjectKey } from "./uploads";
import { prisma } from "./prisma";

/**
 * Profile images (doctor profile photo, organisation logo).
 *
 * Lifecycle:
 *  1. The browser PUTs the image to a staging key under
 *     `profile-image-uploads/{userId}/` using a presigned URL.
 *  2. The server inspects it (magic bytes, size), then copies it — server-side
 *     only — to `profile-images/{userId}/`. The final prefix never receives a
 *     browser PUT, so its content cannot be changed after inspection.
 *  3. The final key is attached to the account during registration
 *     (User.avatarUrl for doctors, LabStaffProfile.logoUrl for organisations).
 *
 * The public read route only serves final-prefix images that are attached to an
 * account; unconfirmed uploads stay unreachable.
 */

export const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
export const PROFILE_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export type ProfileImageMimeType = (typeof PROFILE_IMAGE_MIME_TYPES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const FINAL_KEY_RE = new RegExp(`^profile-images/${UUID}/${UUID}$`);

const stagingPrefix = (userId: string) => `profile-image-uploads/${userId}`;
const finalPrefix = (userId: string) => `profile-images/${userId}`;

/** Detects the image type from the first bytes; never trusts the browser-declared type. */
export function detectImageType(head: Uint8Array): ProfileImageMimeType | null {
  const startsWith = (...bytes: number[]) =>
    bytes.every((b, i) => head[i] === b);
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return "image/png"; // PNG
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg"; // JPEG
  // WEBP: "RIFF" <size> "WEBP"
  if (
    startsWith(0x52, 0x49, 0x46, 0x46) &&
    head.length >= 12 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export const profileImageUploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(300),
  mimeType: z.enum(PROFILE_IMAGE_MIME_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_PROFILE_IMAGE_BYTES),
});

export const profileImageConfirmSchema = z.object({
  key: z.string().trim().min(1).max(300),
});

/** A staging key the browser may upload to. */
export function newStagingProfileImageKey(userId: string): string {
  return newObjectKey(stagingPrefix(userId));
}

/** True when `key` is a staging key owned by `userId`. */
export function isStagingProfileImageKey(key: string, userId: string): boolean {
  return isKeyUnderPrefix(key, stagingPrefix(userId));
}

/** True when `key` is a final key owned by `userId`. */
export function isFinalProfileImageKey(key: string, userId: string): boolean {
  return (
    key.startsWith(`${finalPrefix(userId)}/`) &&
    isValidFinalProfileImageS3Key(key)
  );
}

/** True when `key` is a well-formed final-prefix key, regardless of owner. */
export function isValidFinalProfileImageS3Key(key: string): boolean {
  return FINAL_KEY_RE.test(key);
}

function isKeyUnderPrefix(key: string, prefix: string): boolean {
  if (!key.startsWith(`${prefix}/`)) return false;
  const id = key.slice(prefix.length + 1);
  return id.length <= 64 && UUID_RE.test(id);
}

/** The web URL the image is served from once attached to an account. */
export function publicProfileImageUrl(key: string): string {
  // The S3 key starts with "profile-images/"; the route path already carries that segment.
  return `/api/profile-images/${key.replace(/^profile-images\//, "")}`;
}

/** Verify a staging upload (magic bytes + size) and finalize it under the server-only final prefix. */
export async function finalizeProfileImage(key: string): Promise<string> {
  const inspected = await inspectObject(key);
  const detected = detectImageType(inspected.head);
  if (!detected) throw badRequest("Only PNG, JPG or WEBP images are allowed.");
  if (inspected.sizeBytes > MAX_PROFILE_IMAGE_BYTES)
    throw badRequest("Image is too large. Maximum size is 5MB.");

  // A fresh destination on every finalization: a still-valid presigned staging
  // URL cannot be re-uploaded and confirmed over an already-attached image.
  const userId = key.split("/")[1];
  const finalKey = `${finalPrefix(userId)}/${randomUUID()}`;
  // Copy the exact inspected version into the final (never browser-writable) prefix.
  await copyObject(key, finalKey, inspected.etag, detected);

  // Re-verify the copied object: if anything raced, fail loudly and clean up.
  const copied = await inspectObject(finalKey);
  const copiedType = detectImageType(copied.head);
  if (copiedType !== detected || copied.sizeBytes !== inspected.sizeBytes) {
    await deleteObject(finalKey);
    throw badRequest(
      "Upload failed verification. Please upload the image again.",
    );
  }

  await deleteObject(key);
  return finalKey;
}

/** Verify a final-prefix image (used at registration before attaching it to the account). */
export async function verifyFinalProfileImage(
  key: string,
): Promise<ProfileImageMimeType> {
  const inspected = await inspectObject(key);
  const detected = detectImageType(inspected.head);
  if (!detected) throw badRequest("Only PNG, JPG or WEBP images are allowed.");
  if (inspected.sizeBytes > MAX_PROFILE_IMAGE_BYTES)
    throw badRequest("Image is too large. Maximum size is 5MB.");
  return detected;
}

/** True when the image is attached to an account — only those are publicly readable. */
export async function isProfileImageAttached(key: string): Promise<boolean> {
  const url = publicProfileImageUrl(key);
  const [user, facility] = await Promise.all([
    prisma.user.findFirst({ where: { avatarUrl: url }, select: { id: true } }),
    prisma.labStaffProfile.findFirst({
      where: { logoUrl: url },
      select: { id: true },
    }),
  ]);
  return Boolean(user || facility);
}

/** Stream a stored image for the public read route. */
export async function readProfileImage(
  key: string,
): Promise<{ stream: ReadableStream | null; contentType: string | undefined }> {
  return getObjectStream(key);
}
