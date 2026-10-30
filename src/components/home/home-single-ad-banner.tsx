import { PublicEntryLink as Link } from "@/components/shared/public-entry-link";
import { Building2, ChevronRight } from "lucide-react";
import { IMEDICS_SINGLE_AD_BANNER } from "@/lib/home/imedics-home-content";

/**
 * The single ad banner under the homepage carousel. Shows the active
 * HOMEPAGE_BANNER ad from the admin content manager when one exists and
 * falls back to the built-in default so the slot never renders empty.
 */
export function HomeSingleAdBanner({
  ad,
}: {
  ad?: { title: string; content: string; imageUrl?: string | null; linkUrl?: string | null } | null;
}) {
  const hasAd = Boolean(ad && ad.title.trim() && ad.content.trim());
  const banner = hasAd && ad
    ? {
        title: ad.title,
        content: ad.content,
        imageUrl: ad.imageUrl ?? null,
        ctaHref: ad.linkUrl || IMEDICS_SINGLE_AD_BANNER.ctaHref,
        ctaLabel: ad.linkUrl ? "Learn more" : IMEDICS_SINGLE_AD_BANNER.ctaLabel,
      }
    : { ...IMEDICS_SINGLE_AD_BANNER, imageUrl: null as string | null };
  const external = /^https?:\/\//i.test(banner.ctaHref);
  const ctaClass =
    "inline-flex shrink-0 items-center justify-center gap-1 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-80";

  return (
    <section
      aria-label="Sponsored banner"
      data-testid="home-single-ad-banner"
      className="mx-auto w-full max-w-5xl px-4 pt-2 pb-4"
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          {banner.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-provided remote images
            <img
              src={banner.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-16 w-28 shrink-0 rounded-lg bg-muted object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"
            >
              <Building2 className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{banner.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{banner.content}</p>
          </div>
        </div>
        {external ? (
          <a href={banner.ctaHref} target="_blank" rel="noopener noreferrer sponsored" className={ctaClass}>
            {banner.ctaLabel}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : (
          <Link href={banner.ctaHref} className={ctaClass}>
            {banner.ctaLabel}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
