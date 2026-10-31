import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CONTENT_ENABLED, bodyParagraphs } from "@/lib/content";
import { ContentComingSoon } from "@/components/public/content-coming-soon";

export const revalidate = 300;

const getArticle = (slug: string) =>
  prisma.newsArticle.findFirst({ where: { slug, status: "PUBLISHED" } });

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  if (!CONTENT_ENABLED) return { title: "News", robots: { index: false } };
  const article = await getArticle((await params).slug);
  return article ? { title: article.title, description: article.summary ?? undefined } : { title: "News" };
}

export default async function NewsArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!CONTENT_ENABLED) return <ContentComingSoon kind="news" />;
  const article = await getArticle((await params).slug);
  if (!article) notFound();

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <Link href="/news" className="text-sm text-muted-foreground hover:text-foreground">← All news</Link>
      <h1 className="text-3xl font-bold leading-tight">{article.title}</h1>
      <p className="text-xs text-muted-foreground">
        {[article.authorName, article.publishedAt?.toLocaleDateString("en-US", { dateStyle: "long" })].filter(Boolean).join(" · ")}
      </p>
      {article.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-provided remote image
        <img src={article.coverImageUrl} alt="" decoding="async" className="w-full rounded-xl bg-muted object-cover" />
      )}
      <div className="space-y-4 leading-relaxed">
        {bodyParagraphs(article.body).map((paragraph, i) => (
          <p key={i} className="whitespace-pre-line">{paragraph}</p>
        ))}
      </div>
    </main>
  );
}
