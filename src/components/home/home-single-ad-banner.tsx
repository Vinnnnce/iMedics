import Image from "next/image";
import { PublicEntryLink as Link } from "@/components/shared/public-entry-link";
import { ArrowRight, Building2, Sparkles } from "lucide-react";
import { IMEDICS_SINGLE_AD_BANNER } from "@/lib/home/imedics-home-content";

/**
 * The single ad banner under the homepage carousel.
 *
 * Shows the active HOMEPAGE_BANNER ad from the admin content manager when one
 * exists and falls back to the built-in default so the slot never renders empty.
 *
 * The layout is a large, desktop-first promotional panel inspired by
 * Beeline-style homepage campaign cards, while preserving Medic1905 colors.
 */
export function HomeSingleAdBanner({
  ad,
}: {
  ad?: {
    title: string;
    content: string;
    imageUrl?: string | null;
    linkUrl?: string | null;
  } | null;
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
    : {
        ...IMEDICS_SINGLE_AD_BANNER,
        imageUrl: null as string | null,
      };

  const external = /^https?:\/\//i.test(banner.ctaHref);

  const ctaClass =
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  const fallbackContent = (
    <div className="flex h-full min-h-[220px] w-full flex-col justify-between gap-6 rounded-3xl border border-border bg-card p-6 md:min-h-[280px] md:p-10 lg:p-12">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Sparkles aria-hidden="true" className="h-4 w-4" />
        Featured on Medic1905
      </div>

      <div className="max-w-3xl">
        <h3 className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl xl:text-4xl">
          {banner.title}
        </h3>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
          {banner.content}
        </p>
      </div>

      <div>
        {external ? (
          <a
            href={banner.ctaHref}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={ctaClass}
          >
            {banner.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : (
          <Link href={banner.ctaHref} className={ctaClass}>
            {banner.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <section
      aria-label="Sponsored banner"
      data-testid="home-single-ad-banner"
      className="mx-auto w-full max-w-7xl px-4 pt-2 pb-4 md:px-6 lg:px-8"
    >
      {banner.imageUrl ? (
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
          <div className="relative aspect-[16/10] w-full sm:aspect-[16/7] lg:aspect-[21/7]">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-provided remote images */}
            <img
              src={banner.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />

            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20"
            />

            <div className="relative flex h-full flex-col justify-between gap-6 p-6 md:p-10 lg:p-12">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                Featured on Medic1905
              </div>

              <div className="max-w-3xl">
                <h3 className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl xl:text-4xl">
                  {banner.title}
                </h3>

                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                  {banner.content}
                </p>
              </div>

              <div>
                {external ? (
                  <a
                    href={banner.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className={ctaClass}
                  >
                    {banner.ctaLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : (
                  <Link href={banner.ctaHref} className={ctaClass}>
                    {banner.ctaLabel}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        fallbackContent
      )}

      {/* Small accessibility-friendly fallback icon for screen readers when no image is present */}
      {!banner.imageUrl && (
        <span className="sr-only">
          <Building2 aria-hidden="true" />
        </span>
      )}
    </section>
  );
}
