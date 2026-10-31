import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { HOME_CACHE_TAG } from "@/lib/home/home-data";
import { PUBLISH_STATUSES, nextPublishedAt, optionalImageRef, uniqueSlug } from "@/lib/content";

const fields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  summary: z.string().trim().max(500).nullable().optional().transform((v) => v || null),
  body: z.string().trim().min(1, "The article needs some content").max(50000),
  coverImageUrl: optionalImageRef,
  authorName: z.string().trim().max(120).nullable().optional().transform((v) => v || null),
  status: z.enum(PUBLISH_STATUSES),
};

// GET /api/admin/news — every article, newest first (admin only)
export const GET = withAuth(["ADMIN"], async () => {
  const articles = await prisma.newsArticle.findMany({ orderBy: { updatedAt: "desc" }, take: 200 });
  return NextResponse.json({ articles });
});

const createSchema = z.object({ ...fields, status: fields.status.default("DRAFT") });

// POST /api/admin/news — create an article
export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const data = await parseBody(req, createSchema);
  const article = await prisma.newsArticle.create({
    data: {
      ...data,
      slug: await uniqueSlug("news", data.title),
      publishedAt: nextPublishedAt(data.status, null) ?? null,
    },
  });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "NewsArticle", resourceId: article.id, details: { created: true }, req });
  revalidateTag(HOME_CACHE_TAG, "max");
  return NextResponse.json({ success: true, article }, { status: 201 });
});

const updateSchema = z
  .object({
    id: z.string().uuid(),
    title: fields.title.optional(),
    summary: z.string().trim().max(500).nullable().optional(),
    body: fields.body.optional(),
    coverImageUrl: z.any().optional(),
    authorName: z.string().trim().max(120).nullable().optional(),
    status: z.enum(PUBLISH_STATUSES).optional(),
  })
  .strict();

// PATCH /api/admin/news — edit, publish, archive
export const PATCH = withAuth(["ADMIN"], async (req, { user }) => {
  const { id, coverImageUrl, summary, authorName, ...rest } = await parseBody(req, updateSchema);
  const current = await prisma.newsArticle.findUnique({ where: { id }, select: { publishedAt: true } });
  if (!current) return NextResponse.json({ error: "Article not found" }, { status: 404 });

  const data: Record<string, unknown> = { ...rest };
  if (summary !== undefined) data.summary = summary || null;
  if (authorName !== undefined) data.authorName = authorName || null;
  if (coverImageUrl !== undefined) data.coverImageUrl = optionalImageRef.parse(coverImageUrl);
  const publishedAt = nextPublishedAt(rest.status, current.publishedAt);
  if (publishedAt !== undefined) data.publishedAt = publishedAt;

  const article = await prisma.newsArticle.update({ where: { id }, data });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "NewsArticle", resourceId: id, details: { changed: Object.keys(data) }, req });
  revalidateTag(HOME_CACHE_TAG, "max");
  return NextResponse.json({ success: true, article });
});

// DELETE /api/admin/news — remove permanently
export const DELETE = withAuth(["ADMIN"], async (req, { user }) => {
  const { id } = await parseBody(req, z.object({ id: z.string().uuid() }));
  await prisma.newsArticle.delete({ where: { id } });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "NewsArticle", resourceId: id, details: { removed: true }, req });
  revalidateTag(HOME_CACHE_TAG, "max");
  return NextResponse.json({ success: true });
});
