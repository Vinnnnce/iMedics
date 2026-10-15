import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";

const bodySchema = z.object({ ids: z.array(z.string().uuid()).max(100).optional() });

// POST /api/notifications/read — mark the given notifications (or, with no body, all of them) as read.
export const POST = withAuth(null, async (req, { user }) => {
  const { ids } = bodySchema.parse(await req.json().catch(() => ({})));
  const { count } = await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ success: true, count });
});
