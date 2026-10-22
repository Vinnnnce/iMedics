import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { IMEDICS_SINGLE_AD_BANNER } from "@/lib/home/imedics-home-content";

/**
 * The single ad banner under the homepage carousel. Shows the active
 * HOMEPAGE_BANNER ad from the admin content manager when one exists and
 * falls back to the built-in default so the slot never renders empty.
 */
export function HomeSingleAdBanner({ ad }: { ad?: { title: string; content: string } | null }) {
  const banner = ad && ad.title.trim() && ad.content.trim()
    ? { ...ad, ctaHref: IMEDICS_SINGLE_AD_BANNER.ctaHref, ctaLabel: IMEDICS_SINGLE_AD_BANNER.ctaLabel }
    : IMEDICS_SINGLE_AD_BANNER;

  return (
    <section
      aria-label="Sponsored banner"
      data-testid="home-single-ad-banner"
      className="mx-auto w-full max-w-5xl px-4 pt-2 pb-4"
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"
          >
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{banner.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{banner.content}</p>
          </div>
        </div>
        <Link
          href={banner.ctaHref}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-80"
        >
          {banner.ctaLabel}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
