import Link from "next/link";
import { NotificationList } from "@/components/shared/notification-list";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const user = await requirePageRole("PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN");
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, href: true, readAt: true, createdAt: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 md:px-0">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">Open an item to see the details securely.</p>
        </div>
        <Link href="/profile#notifications" className="text-sm underline">
          Preferences
        </Link>
      </div>
      <NotificationList items={items.map((n) => ({ ...n, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))} />
    </div>
  );
}
