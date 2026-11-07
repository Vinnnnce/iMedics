import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CONTENT_ENABLED, bodyParagraphs } from "@/lib/content";
import { ContentComingSoon } from "@/components/public/content-coming-soon";

export const revalidate = 300;

const getEpisode = (slug: string) =>
  prisma.podcastEpisode.findFirst({ where: { slug, status: "PUBLISHED" } });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!CONTENT_ENABLED) return { title: "Podcasts", robots: { index: false } };
  const episode = await getEpisode((await params).slug);
  return episode ? { title: episode.title, description: episode.description.slice(0, 160) } : { title: "Podcasts" };
}

export default async function PodcastEpisodePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!CONTENT_ENABLED) return <ContentComingSoon kind="podcasts" />;
  const episode = await getEpisode((await params).slug);
  if (!episode) notFound();

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <Link href="/podcasts" className="text-sm text-muted-foreground hover:text-foreground">← All episodes</Link>
      <h1 className="text-3xl font-bold leading-tight">{episode.title}</h1>
      <p className="text-xs text-muted-foreground">
        {[episode.episodeNumber ? `Episode ${episode.episodeNumber}` : null, episode.publishedAt?.toLocaleDateString("en-US", { dateStyle: "long" })].filter(Boolean).join(" · ")}
      </p>
      {episode.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-provided remote image
        <img src={episode.coverImageUrl} alt="" decoding="async" className="max-h-72 w-full rounded-xl bg-muted object-cover" />
      )}
      {episode.audioUrl && (
        <audio controls preload="none" src={episode.audioUrl} className="w-full">
          Your browser does not support audio playback.
        </audio>
      )}
      <div className="space-y-4 leading-relaxed">
        {bodyParagraphs(episode.description).map((paragraph, i) => (
          <p key={i} className="whitespace-pre-line">{paragraph}</p>
        ))}
      </div>
    </main>
  );
}
