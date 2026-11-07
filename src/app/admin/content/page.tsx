import { ContentManager } from "@/components/admin/content-manager";
import { PageHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const [notices, ads] = await Promise.all([
    prisma.notice.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.ad.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }], take: 200 }),
  ]);
  return (
    <>
      <PageHeader title="Notices and ads" description="Announcements and advertisements shown across the platform." />
      <ContentManager
        notices={notices.map((n) => ({ id: n.id, text: n.text, active: n.active, createdAt: n.createdAt.toISOString() }))}
        ads={ads.map((a) => ({ id: a.id, title: a.title, content: a.content, placement: a.placement, active: a.active, createdAt: a.createdAt.toISOString(), imageUrl: a.imageUrl, linkUrl: a.linkUrl, startsAt: a.startsAt?.toISOString() ?? null, endsAt: a.endsAt?.toISOString() ?? null, sortOrder: a.sortOrder }))}
      />
    </>
  );
}
