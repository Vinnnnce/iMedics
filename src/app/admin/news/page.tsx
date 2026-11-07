import { ContentPublisher } from "@/components/admin/content-publisher";
import { PageHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { CONTENT_ENABLED } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const [articles, episodes] = await Promise.all([
    prisma.newsArticle.findMany({ orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.podcastEpisode.findMany({ orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);
  return (
    <>
      <PageHeader
        title="News and podcasts"
        description={
          CONTENT_ENABLED
            ? "Publish articles and podcast episodes shown on the public site."
            : "Prepare and publish content now. The public pages show “coming soon” until NEXT_PUBLIC_FEATURE_NEWS_PODCAST is set to true."
        }
      />
      <ContentPublisher
        articles={articles.map((a) => ({
          id: a.id, slug: a.slug, title: a.title, summary: a.summary, body: a.body, coverImageUrl: a.coverImageUrl,
          authorName: a.authorName, status: a.status, publishedAt: a.publishedAt?.toISOString() ?? null,
        }))}
        episodes={episodes.map((e) => ({
          id: e.id, slug: e.slug, title: e.title, description: e.description, audioUrl: e.audioUrl,
          coverImageUrl: e.coverImageUrl, durationSeconds: e.durationSeconds, episodeNumber: e.episodeNumber,
          status: e.status, publishedAt: e.publishedAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
