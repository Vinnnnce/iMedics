import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { badRequest } from "@/lib/errors";

const querySchema = z.object({
  since: z.coerce.date().optional(),
  after: z.uuid().optional(),
  unread: z.enum(["1", "0"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// GET /api/notifications — recent notifications plus the unread count. `since` lets the app poll for new ones.
export const GET = withAuth(null, async (req, { user }) => {
  const { since, after, unread, limit } = parseQuery(req, querySchema);
  const checkedAt = new Date().toISOString();
  const anchor = after ? await prisma.notification.findFirst({
    where: { id: after, userId: user.id }, select: { id: true, createdAt: true },
  }) : null;
  if (after && !anchor) throw badRequest("Invalid notification cursor");
  const polling = Boolean(anchor || since);

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: user.id, ...(unread === "1" ? { readAt: null } : {}),
        ...(anchor ? { OR: [{ createdAt: { gt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { gt: anchor.id } }] }
          : since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: [{ createdAt: polling ? "asc" : "desc" }, { id: polling ? "asc" : "desc" }],
      take: limit + 1,
      select: { id: true, type: true, title: true, body: true, href: true, data: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  const notifications = rows.slice(0, limit);
  return NextResponse.json({
    checkedAt, hasMore: rows.length > limit,
    nextCursor: (polling ? notifications.at(-1) : notifications[0])?.id ?? after ?? null,
    unreadCount,
    notifications: notifications.map(({ data, ...n }) => ({
      ...n,
      toast: typeof data === "object" && data !== null && !Array.isArray(data) ? data.toast !== false : true,
    })),
  });
});
