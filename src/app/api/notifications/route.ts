import { NextResponse, type NextRequest } from "next/server";
import { withAuth, parseQuery } from "@/lib/api";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";

const querySchema = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  unread: z.enum(["1", "0"]).optional(),
});

// GET /api/notifications — the signed-in user's notifications, ordered ascending
// so a cursor can be kept. Pagination: the client sends `after` (the last id it
// holds) and receives at most `limit` rows plus `hasMore`/`nextCursor`.
export const GET = withAuth(null, async (req: NextRequest, { user }) => {
  const query = parseQuery(req, querySchema);
  const limit = query.limit ?? 30;
  const after = query.after;

  let cursor: { id: string; createdAt: Date } | null = null;
  if (after) {
    cursor = await prisma.notification.findFirst({
      where: { id: after, userId: user.id },
      select: { id: true, createdAt: true },
    });
    if (!cursor) throw new ApiError(400, "Invalid notification cursor");
  }

  const [unread, notifications] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(query.unread === "1" ? { readAt: null } : {}),
        ...(after && cursor
          ? { OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] }
          : {}),
      },
      orderBy: after ? [{ createdAt: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    }),
  ]);

  const hasMore = notifications.length > limit;
  const rows = notifications.slice(0, limit);
  return NextResponse.json({
    notifications: rows.map(({ data, ...rest }) => ({ ...rest, toast: data?.toast !== false })),
    hasMore,
    nextCursor: hasMore && rows.length > 0 ? rows[rows.length - 1].id : null,
    unread,
  });
});
