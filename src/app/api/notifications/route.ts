import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";

const querySchema = z.object({
  since: z.coerce.date().optional(),
  unread: z.enum(["1", "0"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// GET /api/notifications — recent notifications plus the unread count. `since` lets the app poll for new ones.
export const GET = withAuth(null, async (req, { user }) => {
  const { since, unread, limit } = parseQuery(req, querySchema);

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id, ...(since ? { createdAt: { gt: since } } : {}), ...(unread === "1" ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, type: true, title: true, body: true, href: true, data: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return NextResponse.json({
    unreadCount,
    notifications: rows.map(({ data, ...n }) => ({
      ...n,
      toast: typeof data === "object" && data !== null && !Array.isArray(data) ? data.toast !== false : true,
    })),
  });
});
