import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

// GET /api/admin/notices — list all notices (admin only)
export const GET = withAuth(["ADMIN"], async () => {
  const notices = await prisma.notice.findMany({ take: 200, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ notices });
});

const createNoticeSchema = z.object({ text: z.string().trim().min(1, "Notice text is required").max(500) });

// POST /api/admin/notices — publish a notice
export const POST = withAuth(["ADMIN"], async (req) => {
  const { text } = await parseBody(req, createNoticeSchema);
  const notice = await prisma.notice.create({ data: { text } });
  return NextResponse.json({ success: true, notice }, { status: 201 });
});

const updateSchema = z.object({ id: z.string().uuid(), active: z.boolean().optional(), text: z.string().trim().min(1).max(500).optional() });

// PATCH /api/admin/notices — toggle on or off, or edit
export const PATCH = withAuth(["ADMIN"], async (req, { user }) => {
  const { id, ...data } = await parseBody(req, updateSchema);
  const item = await prisma.notice.update({ where: { id }, data });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "Notice", resourceId: id, details: { changed: Object.keys(data) }, req });
  return NextResponse.json({ success: true, notice: item });
});

const deleteSchema = z.object({ id: z.string().uuid() });

// DELETE /api/admin/notices — remove permanently
export const DELETE = withAuth(["ADMIN"], async (req, { user }) => {
  const { id } = await parseBody(req, deleteSchema);
  await prisma.notice.delete({ where: { id } });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_CONTENT_CHANGED", resourceType: "Notice", resourceId: id, details: { removed: true }, req });
  return NextResponse.json({ success: true });
});
