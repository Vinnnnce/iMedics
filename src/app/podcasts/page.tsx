import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CONTENT_ENABLED } from "@/lib/content";
import { ContentComingSoon } from "@/components/public/content-coming-soon";

export const metadata: Metadata = { title: "Podcasts", robots: CONTENT_ENABLED ? undefined : { index: false } };
export const revalidate = 300;

export default async function PodcastsPage() {
  if (!CONTENT_ENABLED) return <ContentComingSoon kind="podcasts" />;

  const episodes = await prisma.podcastEpisode.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: { id: true, slug: true, title: true, description: true, coverImageUrl: true, episodeNumber: true, durationSeconds: true, publishedAt: true },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Podcasts</h1>
      {episodes.length === 0 && <p className="text-sm text-muted-foreground">No episodes have been published yet.</p>}
      <ul className="space-y-4">
        {episodes.map((e) => (
          <li key={e.id}>
            <Link href={`/podcasts/${e.slug}`} className="flex gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent">
              {e.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- admin-provided remote image
                <img src={e.coverImageUrl} alt="" loading="lazy" decoding="async" className="h-20 w-20 shrink-0 rounded-lg bg-muted object-cover" />
              )}
              <div className="min-w-0">
                <h2 className="font-semibold">{e.episodeNumber ? `${e.episodeNumber}. ` : ""}{e.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {[e.publishedAt?.toLocaleDateString("en-US", { dateStyle: "medium" }), e.durationSeconds ? `${Math.max(1, Math.round(e.durationSeconds / 60))} min` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
