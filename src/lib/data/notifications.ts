import { prisma } from "../prisma";

export function listUnreadNotifications(userId: string, take = 5) {
  return prisma.notification.findMany({
    where: { userId, readAt: null },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, title: true, body: true, createdAt: true },
  });
}
