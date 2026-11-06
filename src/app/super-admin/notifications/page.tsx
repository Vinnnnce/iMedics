import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { thirtyDaysAgo } from "@/lib/superadmin/windows";
import { formatClinicDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "NOTIFICATIONS");
  const [notices, monthAgoCount, unread, activeAds] = await Promise.all([
    prisma.notice.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, text: true, active: true, createdAt: true } }),
    prisma.notification.count({ where: { createdAt: { gte: thirtyDaysAgo() } } }),
    prisma.notification.count({ where: { readAt: null } }),
    prisma.ad.count({ where: { active: true } }),
  ]);

  return <>
    <PageHeader title="Notifications" description="Platform-wide communication: email, in-app, push, SMS and announcements" />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Notifications (30 days)" value={monthAgoCount.toLocaleString()} />
      <StatCard label="Unread notifications" value={unread.toLocaleString()} />
      <StatCard label="Active advertisements" value={activeAds.toLocaleString()} />
    </section>
    <Card className="beeline-card"><CardContent className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Bell className="size-4" />Platform announcements</h2>
        <Link href="/admin/news" className="inline-flex items-center gap-1 text-sm font-medium text-primary">Publish news and notices <ArrowRight className="size-3.5" /></Link>
      </div>
      {notices.map((n) => <article key={n.id} className="min-w-0 space-y-1 rounded-xl border p-3 text-sm">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p className="line-clamp-1 font-medium">{n.text}</p>
          <div className="flex items-center gap-2"><Badge variant={n.active ? "default" : "secondary"}>{n.active ? "active" : "inactive"}</Badge><span className="text-xs text-muted-foreground">{formatClinicDateTime(n.createdAt)}</span></div>
        </div>
      </article>)}
      {!notices.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No notices published yet.</p>}
      <p className="text-xs text-muted-foreground">Facilities configure their own permitted communications; mandatory platform security and privacy notifications always take precedence. {activeAds} advertisement{activeAds === 1 ? "" : "s"} currently active.</p>
    </CardContent></Card>
  </>;
}
