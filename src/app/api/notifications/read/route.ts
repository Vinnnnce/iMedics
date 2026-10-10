import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";

// POST /api/notifications/read — mark all of the caller's notifications as read
export const POST = withAuth(null, async (_req, { user }) => {
  const { count } = await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ success: true, count });
});
