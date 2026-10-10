import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";

// GET /api/admin/notices — list all notices (admin only)
export const GET = withAuth(["ADMIN"], async () => {
  const notices = await prisma.notice.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ notices });
});

const createNoticeSchema = z.object({ text: z.string().trim().min(1, "Notice text is required").max(500) });

// POST /api/admin/notices — publish a notice
export const POST = withAuth(["ADMIN"], async (req) => {
  const { text } = await parseBody(req, createNoticeSchema);
  const notice = await prisma.notice.create({ data: { text } });
  return NextResponse.json({ success: true, notice }, { status: 201 });
});

const toggleNoticeSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

// PATCH /api/admin/notices — toggle a notice on or off
export const PATCH = withAuth(["ADMIN"], async (req) => {
  const { id, active } = await parseBody(req, toggleNoticeSchema);
  const notice = await prisma.notice.update({ where: { id }, data: { active } });
  return NextResponse.json({ success: true, notice });
});
