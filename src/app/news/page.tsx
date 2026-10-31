import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CONTENT_ENABLED } from "@/lib/content";
import { ContentComingSoon } from "@/components/public/content-coming-soon";

export const metadata: Metadata = { title: "News", robots: CONTENT_ENABLED ? undefined : { index: false } };
export const revalidate = 300;

export default async function NewsPage() {
  if (!CONTENT_ENABLED) return <ContentComingSoon kind="news" />;

  const articles = await prisma.newsArticle.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 30,
    select: { id: true, slug: true, title: true, summary: true, coverImageUrl: true, authorName: true, publishedAt: true },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">News</h1>
      {articles.length === 0 && <p className="text-sm text-muted-foreground">No articles have been published yet.</p>}
      <ul className="space-y-4">
        {articles.map((a) => (
          <li key={a.id}>
            <Link href={`/news/${a.slug}`} className="flex gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent">
              {a.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- admin-provided remote image
                <img src={a.coverImageUrl} alt="" loading="lazy" decoding="async" className="h-24 w-32 shrink-0 rounded-lg bg-muted object-cover" />
              )}
              <div className="min-w-0">
                <h2 className="font-semibold">{a.title}</h2>
                {a.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.summary}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {[a.authorName, a.publishedAt?.toLocaleDateString("en-US", { dateStyle: "medium" })].filter(Boolean).join(" · ")}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
