import { randomUUID } from "node:crypto";
import { z } from "zod";
import { badRequest } from "./errors";
import { copyObject, deleteObject, getObjectStream, inspectObject } from "./storage";
import { newObjectKey } from "./uploads";
import { prisma } from "./prisma";
import {
  MAX_PROFILE_IMAGE_BYTES,
  PROFILE_IMAGE_MIME_TYPES,
  detectImageType,
} from "./profile-images";

/**
 * Site media: images admins upload for ads, news covers and podcast covers.
 * Same lifecycle as profile images — the browser PUTs to a staging key, the
 * server inspects the bytes, then copies the exact inspected object to a final
 * key the browser can never write to. The public read route only serves final
 * images that are actually attached to an ad, article or episode.
 */

export const MAX_SITE_IMAGE_BYTES = MAX_PROFILE_IMAGE_BYTES;
export const SITE_IMAGE_MIME_TYPES = PROFILE_IMAGE_MIME_TYPES;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_RE = new RegExp(`^${UUID}$`, "i");
const FINAL_KEY_RE = new RegExp(`^site-media/${UUID}/${UUID}$`, "i");

const stagingPrefix = (userId: string) => `site-media-uploads/${userId}`;
const finalPrefix = (userId: string) => `site-media/${userId}`;

export const siteImageUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(300),
  mimeType: z.enum(SITE_IMAGE_MIME_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_SITE_IMAGE_BYTES),
});
export const siteImageConfirmSchema = z.object({ key: z.string().trim().min(1).max(300) });

export function newStagingSiteImageKey(userId: string): string {
  return newObjectKey(stagingPrefix(userId));
}

/** True when `key` is a staging key owned by `userId`. */
export function isStagingSiteImageKey(key: string, userId: string): boolean {
  const prefix = `${stagingPrefix(userId)}/`;
  return key.startsWith(prefix) && UUID_RE.test(key.slice(prefix.length));
}

/** True when `key` is a well-formed final site-media key, whoever owns it. */
export function isValidFinalSiteImageKey(key: string): boolean {
  return FINAL_KEY_RE.test(key);
}

/** The web path the image is served from once attached to content. */
export function publicSiteMediaUrl(key: string): string {
  return `/api/site-media/${key.replace(/^site-media\//, "")}`;
}

/** Verify a staging upload (magic bytes + size) and finalize it under the server-only prefix. */
export async function finalizeSiteImage(key: string): Promise<string> {
  const inspected = await inspectObject(key);
  const detected = detectImageType(inspected.head);
  if (!detected) throw badRequest("Only PNG, JPG or WEBP images are allowed.");
  if (inspected.sizeBytes > MAX_SITE_IMAGE_BYTES) throw badRequest("Image is too large. Maximum size is 5MB.");

  const userId = key.split("/")[1];
  const finalKey = `${finalPrefix(userId)}/${randomUUID()}`;
  await copyObject(key, finalKey, inspected.etag, detected);

  const copied = await inspectObject(finalKey);
  if (detectImageType(copied.head) !== detected || copied.sizeBytes !== inspected.sizeBytes) {
    await deleteObject(finalKey);
    throw badRequest("Upload failed verification. Please upload the image again.");
  }
  await deleteObject(key);
  return finalKey;
}

/** True when the image is attached to an ad, news article or podcast episode. */
export async function isSiteImageAttached(key: string): Promise<boolean> {
  const url = publicSiteMediaUrl(key);
  const [ad, article, episode] = await Promise.all([
    prisma.ad.findFirst({ where: { imageUrl: url }, select: { id: true } }),
    prisma.newsArticle.findFirst({ where: { coverImageUrl: url }, select: { id: true } }),
    prisma.podcastEpisode.findFirst({ where: { coverImageUrl: url }, select: { id: true } }),
  ]);
  return Boolean(ad || article || episode);
}

export async function readSiteImage(key: string) {
  return getObjectStream(key);
}
