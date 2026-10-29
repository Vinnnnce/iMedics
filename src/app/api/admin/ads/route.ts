import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { HOME_CACHE_TAG } from "@/lib/home/home-data";
import { optionalImageRef } from "@/lib/content";

const PLACEMENTS = ["SIDEBAR", "DASHBOARD", "LOGIN", "HOMEPAGE_CAROUSEL", "HOMEPAGE_BANNER"] as const;

/** An https URL, or empty/null to clear the field. Never javascript:/data: URLs. */
const optionalHttpsUrl = z
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

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()
  .transform((value) => (value ? new Date(value) : null));

const adFields = {
  title: z.string().trim().min(1, "Ad title is required").max(120),
  content: z.string().trim().min(1, "Ad content is required").max(1000),
  placement: z.enum(PLACEMENTS),
  imageUrl: optionalImageRef,
  linkUrl: optionalHttpsUrl,
  startsAt: optionalDate,
  endsAt: optionalDate,
  sortOrder: z.number().int().min(0).max(999),
};

/** The ad window must be a real range when both ends are set. */
function validWindow(v: { startsAt?: Date | null; endsAt?: Date | null }) {
  return !v.startsAt || !v.endsAt || v.endsAt > v.startsAt;
}
const WINDOW_ERROR = { message: "The end date must be after the start date", path: ["endsAt"] };

// GET /api/admin/ads — list all advertisements (admin only)
export const GET = withAuth(["ADMIN"], async () => {
  const ads = await prisma.ad.findMany({
    orderBy: [{ placement: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    take: 500,
  });
  return NextResponse.json({ ads });
});

const createAdSchema = z
  .object({ ...adFields, placement: adFields.placement.default("SIDEBAR"), sortOrder: adFields.sortOrder.default(0) })
  .refine(validWindow, WINDOW_ERROR);

// POST /api/admin/ads — publish an advertisement
export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const data = await parseBody(req, createAdSchema);
  const ad = await prisma.ad.create({ data });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "Ad", resourceId: ad.id, details: { created: true }, req });
  revalidateTag(HOME_CACHE_TAG, "max");
  return NextResponse.json({ success: true, ad }, { status: 201 });
});

const updateSchema = z
  .object({
    id: z.string().uuid(),
    active: z.boolean().optional(),
    title: adFields.title.optional(),
    content: adFields.content.optional(),
    placement: adFields.placement.optional(),
    // Optional fields: an absent key leaves the stored value unchanged, an
    // explicit null/"" clears it (the transform maps both to null).
    imageUrl: z.any().optional(),
    linkUrl: z.any().optional(),
    startsAt: z.any().optional(),
    endsAt: z.any().optional(),
    sortOrder: adFields.sortOrder.optional(),
  })
  .strict();

// PATCH /api/admin/ads — toggle on or off, or edit
export const PATCH = withAuth(["ADMIN"], async (req, { user }) => {
  const raw = await parseBody(req, updateSchema);
  const { id, imageUrl, linkUrl, startsAt, endsAt, ...rest } = raw;
  const data: Record<string, unknown> = { ...rest };

  if (imageUrl !== undefined) data.imageUrl = optionalImageRef.parse(imageUrl);
  if (linkUrl !== undefined) data.linkUrl = optionalHttpsUrl.parse(linkUrl);
  if (startsAt !== undefined) data.startsAt = optionalDate.parse(startsAt);
  if (endsAt !== undefined) data.endsAt = optionalDate.parse(endsAt);
  if (!validWindow({ startsAt: data.startsAt as Date | null | undefined, endsAt: data.endsAt as Date | null | undefined })) {
    return NextResponse.json({ error: WINDOW_ERROR.message }, { status: 400 });
  }

  const item = await prisma.ad.update({ where: { id }, data });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "Ad", resourceId: id, details: { changed: Object.keys(data) }, req });
  revalidateTag(HOME_CACHE_TAG, "max");
  return NextResponse.json({ success: true, ad: item });
});

const deleteSchema = z.object({ id: z.string().uuid() });

// DELETE /api/admin/ads — remove permanently
export const DELETE = withAuth(["ADMIN"], async (req, { user }) => {
  const { id } = await parseBody(req, deleteSchema);
  await prisma.ad.delete({ where: { id } });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "Ad", resourceId: id, details: { removed: true }, req });
  revalidateTag(HOME_CACHE_TAG, "max");
  return NextResponse.json({ success: true });
});
