import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";

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

const toggleAdSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

// PATCH /api/admin/ads — toggle an ad on or off
export const PATCH = withAuth(["ADMIN"], async (req) => {
  const { id, active } = await parseBody(req, toggleAdSchema);
  const ad = await prisma.ad.update({ where: { id }, data: { active } });
  return NextResponse.json({ success: true, ad });
});
