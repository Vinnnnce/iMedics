import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

// GET /api/admin/ads — list all advertisements (admin only)
export const GET = withAuth(["ADMIN"], async () => {
  const ads = await prisma.ad.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ads });
});

const createAdSchema = z.object({
  title: z.string().trim().min(1, "Ad title is required").max(120),
  content: z.string().trim().min(1, "Ad content is required").max(1000),
  placement: z.enum(["SIDEBAR", "DASHBOARD", "LOGIN"]).default("SIDEBAR"),
});

// POST /api/admin/ads — publish an advertisement
export const POST = withAuth(["ADMIN"], async (req) => {
  const data = await parseBody(req, createAdSchema);
  const ad = await prisma.ad.create({ data });
  return NextResponse.json({ success: true, ad }, { status: 201 });
});

const updateSchema = z.object({ id: z.string().uuid(), active: z.boolean().optional(), title: z.string().trim().min(1).max(120).optional(), content: z.string().trim().min(1).max(1000).optional(), placement: z.enum(["SIDEBAR", "DASHBOARD", "LOGIN"]).optional() });

// PATCH /api/admin/ads — toggle on or off, or edit
export const PATCH = withAuth(["ADMIN"], async (req, { user }) => {
  const { id, ...data } = await parseBody(req, updateSchema);
  const item = await prisma.ad.update({ where: { id }, data });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "Ad", resourceId: id, details: { changed: Object.keys(data) }, req });
  return NextResponse.json({ success: true, ad: item });
});

const deleteSchema = z.object({ id: z.string().uuid() });

// DELETE /api/admin/ads — remove permanently
export const DELETE = withAuth(["ADMIN"], async (req, { user }) => {
  const { id } = await parseBody(req, deleteSchema);
  await prisma.ad.delete({ where: { id } });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "Ad", resourceId: id, details: { removed: true }, req });
  return NextResponse.json({ success: true });
});
