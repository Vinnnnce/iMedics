import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { HOME_CACHE_TAG } from "@/lib/home/home-data";
import { PUBLISH_STATUSES, nextPublishedAt, optionalHttpsUrl, optionalImageRef, uniqueSlug } from "@/lib/content";

const optionalInt = (max: number) =>
  z.number().int().min(0).max(max).nullable().optional().transform((v) => v ?? null);

const fields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "A description is required").max(10000),
  audioUrl: optionalHttpsUrl,
  coverImageUrl: optionalImageRef,
  durationSeconds: optionalInt(86400),
  episodeNumber: optionalInt(9999),
  status: z.enum(PUBLISH_STATUSES),
};

// GET /api/admin/podcasts — every episode, newest first (admin only)
export const GET = withAuth(["ADMIN"], async () => {
  const episodes = await prisma.podcastEpisode.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
  return NextResponse.json({ episodes });
});

const createSchema = z.object({ ...fields, status: fields.status.default("DRAFT") });

// POST /api/admin/podcasts — create an episode
export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const data = await parseBody(req, createSchema);
  if (data.status === "PUBLISHED" && !data.audioUrl) {
    return NextResponse.json({ error: "Add the audio URL before publishing an episode" }, { status: 400 });
  }
  const episode = await prisma.podcastEpisode.create({
    data: { ...data, slug: await uniqueSlug("podcast", data.title), publishedAt: nextPublishedAt(data.status, null) ?? null },
  });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "PodcastEpisode", resourceId: episode.id, details: { created: true }, req });
  revalidateTag(HOME_CACHE_TAG, "max");
  return NextResponse.json({ success: true, episode }, { status: 201 });
});

const updateSchema = z
  .object({
    id: z.string().uuid(),
    title: fields.title.optional(),
    description: fields.description.optional(),
    audioUrl: z.any().optional(),
    coverImageUrl: z.any().optional(),
    durationSeconds: z.number().int().min(0).max(86400).nullable().optional(),
    episodeNumber: z.number().int().min(0).max(9999).nullable().optional(),
    status: z.enum(PUBLISH_STATUSES).optional(),
  })
  .strict();

// PATCH /api/admin/podcasts — edit, publish, archive
export const PATCH = withAuth(["ADMIN"], async (req, { user }) => {
  const { id, audioUrl, coverImageUrl, ...rest } = await parseBody(req, updateSchema);
  const current = await prisma.podcastEpisode.findUnique({ where: { id }, select: { publishedAt: true, audioUrl: true } });
  if (!current) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

  const data: Record<string, unknown> = { ...rest };
  if (audioUrl !== undefined) data.audioUrl = optionalHttpsUrl.parse(audioUrl);
  if (coverImageUrl !== undefined) data.coverImageUrl = optionalImageRef.parse(coverImageUrl);
  const finalAudio = "audioUrl" in data ? (data.audioUrl as string | null) : current.audioUrl;
  if (rest.status === "PUBLISHED" && !finalAudio) {
    return NextResponse.json({ error: "Add the audio URL before publishing an episode" }, { status: 400 });
  }
  const publishedAt = nextPublishedAt(rest.status, current.publishedAt);
  if (publishedAt !== undefined) data.publishedAt = publishedAt;

  const episode = await prisma.podcastEpisode.update({ where: { id }, data });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "PodcastEpisode", resourceId: id, details: { changed: Object.keys(data) }, req });
  revalidateTag(HOME_CACHE_TAG, "max");
  return NextResponse.json({ success: true, episode });
});

// DELETE /api/admin/podcasts — remove permanently
export const DELETE = withAuth(["ADMIN"], async (req, { user }) => {
  const { id } = await parseBody(req, z.object({ id: z.string().uuid() }));
  await prisma.podcastEpisode.delete({ where: { id } });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "PodcastEpisode", resourceId: id, details: { removed: true }, req });
  revalidateTag(HOME_CACHE_TAG, "max");
  return NextResponse.json({ success: true });
});
