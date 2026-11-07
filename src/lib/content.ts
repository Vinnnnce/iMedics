import { z } from "zod";
import { prisma } from "@/lib/prisma";

/**
 * News and podcasts ship dark: admins can prepare and publish content, but the
 * public pages show "coming soon" until NEXT_PUBLIC_FEATURE_NEWS_PODCAST=true.
 */
export const CONTENT_ENABLED = process.env.NEXT_PUBLIC_FEATURE_NEWS_PODCAST === "true";

/** An https URL, or empty/null to clear the field. Never javascript:/data: URLs. */
export const optionalHttpsUrl = z
  .union([
    z
      .string()
      .trim()
      .max(500)
      .url("Enter a valid URL")
      .refine((value) => value.startsWith("https://"), "Only https:// URLs are allowed"),
    z.literal(""),
  ])
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

const SITE_MEDIA_PATH =
  /^\/api\/site-media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An image reference: an https URL, or the path of an image uploaded through
 * the admin media uploader (/api/site-media/…). Empty/null clears the field.
 */
export const optionalImageRef = z
  .union([
    z
      .string()
      .trim()
      .max(500)
      .refine(
        (value) => SITE_MEDIA_PATH.test(value) || (URL.canParse(value) && value.startsWith("https://")),
        "Use an https:// image URL or upload an image",
      ),
    z.literal(""),
  ])
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

export const PUBLISH_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

/** Lower-case, hyphenated, ASCII slug derived from a title. */
export function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return base || "item";
}

/** A slug that is not used yet by the given content type (suffix -2, -3, …). */
export async function uniqueSlug(kind: "news" | "podcast", title: string): Promise<string> {
  const base = slugify(title);
  const taken = async (slug: string) =>
    kind === "news"
      ? prisma.newsArticle.findUnique({ where: { slug }, select: { id: true } })
      : prisma.podcastEpisode.findUnique({ where: { slug }, select: { id: true } });
  let candidate = base;
  for (let n = 2; await taken(candidate); n += 1) candidate = `${base}-${n}`;
  return candidate;
}

/** The publish time to store: now when first published, kept afterwards, cleared for drafts. */
export function nextPublishedAt(
  status: (typeof PUBLISH_STATUSES)[number] | undefined,
  current: Date | null,
): Date | null | undefined {
  if (status === undefined) return undefined;
  if (status === "PUBLISHED") return current ?? new Date();
  if (status === "DRAFT") return null;
  return current; // ARCHIVED keeps its original publish date
}

/** Splits an article body into paragraphs for safe plain-text rendering. */
export function bodyParagraphs(body: string): string[] {
  return body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}
