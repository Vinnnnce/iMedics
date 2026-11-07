"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PublicEntryLink as Link } from "@/components/shared/public-entry-link";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { IMEDICS_SINGLE_AD_BANNER } from "@/lib/home/imedics-home-content";

export interface HomePromoSlide {
  title: string;
  content: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
}

interface NormalizedPromoSlide {
  title: string;
  content: string;
  imageUrl: string | null;
  ctaHref: string;
  ctaLabel: string;
}

const AUTOPLAY_DELAY_MS = 6000;

/**
 * A Beeline-style promotional carousel beneath the homepage carousel.
 *
 * Accepts one or more admin-managed HOMEPAGE_BANNER ads. If no ads are
 * supplied, it falls back to the built-in default so the slot is never empty.
 */
export function HomeSingleAdBanner({
  ads,
}: {
  ads?: HomePromoSlide[] | HomePromoSlide | null;
}) {
  const slides = normalizeSlides(ads);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const activeSlide: NormalizedPromoSlide | undefined = slides[activeIndex];

  const goTo = useCallback(
    (index: number) => {
      if (slides.length === 0) return;

      setActiveIndex(((index % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  const goNext = useCallback(() => {
    goTo(activeIndex + 1);
  }, [activeIndex, goTo]);

  const goPrevious = useCallback(() => {
    goTo(activeIndex - 1);
  }, [activeIndex, goTo]);

  useEffect(() => {
    if (isPaused || slides.length < 2) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, AUTOPLAY_DELAY_MS);

    return () => window.clearInterval(timer);
  }, [isPaused, slides.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        goPrevious();
      }

      if (event.key === "ArrowRight") {
        goNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrevious]);

  if (!activeSlide) {
    return null;
  }

  const external = /^https?:\/\//i.test(activeSlide.ctaHref);

  const ctaClass =
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <section
      aria-label="Featured promotions"
      data-testid="home-single-ad-banner"
      className="mx-auto w-full max-w-7xl px-4 pt-2 pb-4 md:px-6 lg:px-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div
        className="relative overflow-hidden rounded-3xl border border-border bg-card"
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured promotions"
      >
        <div
          className="relative aspect-[16/12] w-full sm:aspect-[16/8] lg:aspect-[21/7]"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const startX = touchStartX.current;
            const endX = event.changedTouches[0]?.clientX ?? null;

            touchStartX.current = null;

            if (startX == null || endX == null) return;

            const difference = endX - startX;

            if (Math.abs(difference) < 50) return;

            if (difference < 0) {
              goNext();
            } else {
              goPrevious();
            }
          }}
        >
          {slides.map((slide, index) => {
            const isActive = index === activeIndex;
            const slideExternal = /^https?:\/\//i.test(slide.ctaHref);

            return (
              <div
                key={`${slide.title}-${index}`}
                aria-hidden={!isActive}
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${slides.length}`}
                className={`absolute inset-0 transition-opacity duration-500 ${
                  isActive ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                {slide.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- admin-provided remote images */}
                    <img
                      src={slide.imageUrl}
                      alt=""
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                    />

                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/10"
                    />
                  </>
                ) : (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-br from-accent via-card to-background"
                  />
                )}

                <div className="relative flex h-full flex-col justify-between gap-6 p-6 md:p-10 lg:p-12">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Sparkles aria-hidden="true" className="h-4 w-4" />
                    Featured on Medic1905
                  </div>

                  <div className="max-w-3xl">
                    <h3 className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl xl:text-4xl">
                      {slide.title}
                    </h3>

                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                      {slide.content}
                    </p>
                  </div>

                  <div>
                    {slideExternal ? (
                      <a
                        href={slide.ctaHref}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className={ctaClass}
                        tabIndex={isActive ? 0 : -1}
                      >
                        {slide.ctaLabel}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    ) : (
                      <Link
                        href={slide.ctaHref}
                        className={ctaClass}
                        tabIndex={isActive ? 0 : -1}
                      >
                        {slide.ctaLabel}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrevious}
              aria-label="Previous promotion"
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:left-5"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={goNext}
              aria-label="Next promotion"
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:right-5"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
              {slides.map((slide, index) => (
                <button
                  key={`dot-${slide.title}-${index}`}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`Go to promotion ${index + 1}`}
                  aria-current={index === activeIndex}
                  className={`h-2.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    index === activeIndex
                      ? "w-7 bg-foreground"
                      : "w-2.5 bg-muted-foreground/40 hover:bg-muted-foreground/70"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function normalizeSlides(
  ads: HomePromoSlide[] | HomePromoSlide | null | undefined,
): NormalizedPromoSlide[] {
  const incoming = Array.isArray(ads) ? ads : ads ? [ads] : [];

  const validAds = incoming
    .filter((ad) => Boolean(ad?.title?.trim() && ad?.content?.trim()))
    .map((ad) => ({
      title: ad.title,
      content: ad.content,
      imageUrl: ad.imageUrl ?? null,
      ctaHref: ad.linkUrl || IMEDICS_SINGLE_AD_BANNER.ctaHref,
      ctaLabel: ad.linkUrl ? "Learn more" : IMEDICS_SINGLE_AD_BANNER.ctaLabel,
    }));

  if (validAds.length > 0) {
    return validAds;
  }

  return [
    {
      title: IMEDICS_SINGLE_AD_BANNER.title,
      content: IMEDICS_SINGLE_AD_BANNER.content,
      imageUrl: null,
      ctaHref: IMEDICS_SINGLE_AD_BANNER.ctaHref,
      ctaLabel: IMEDICS_SINGLE_AD_BANNER.ctaLabel,
    },
  ];
}
