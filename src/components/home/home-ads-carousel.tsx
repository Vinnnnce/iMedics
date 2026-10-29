"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar, ChevronLeft, ChevronRight, FlaskConical, FolderOpen, HeartPulse,
  Pause, Play, Sparkles, Stethoscope, type LucideIcon,
} from "lucide-react";
import { IMEDICS_HOME_SLIDES, type ImedicsHomeSlide } from "@/lib/home/imedics-home-content";

const SLIDE_ICONS: Record<ImedicsHomeSlide["icon"], LucideIcon> = {
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  flask: FlaskConical,
  sparkles: Sparkles,
  calendar: Calendar,
  folder: FolderOpen,
};

const AUTO_ADVANCE_MS = 6000;

/**
 * Sliding promotional card for the homepage. Slides are data-driven (see
 * imedics-home-content.ts) so more can be added without touching this
 * component. When the admin content manager has active HOMEPAGE_CAROUSEL ads
 * they replace the built-in slides. Auto-advances, pauses on hover/focus and
 * via an explicit pause control, honours prefers-reduced-motion, and supports
 * an optional image per slide (rendered in grayscale to keep the monochrome
 * system; a failed image falls back to the slide icon).
 */
export function HomeAdsCarousel({ slides }: { slides?: readonly ImedicsHomeSlide[] }) {
  const [rawIndex, setRawIndex] = useState(0);
  // Hover and focus are tracked separately so leaving the slide while the
  // pause button is focused never restarts autoplay unexpectedly.
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const items = slides && slides.length > 0 ? slides : IMEDICS_HOME_SLIDES;
  const total = items.length;
  // Derived, never stale: if the slide set shrinks (admin ads change), the
  // active index clamps to the last valid slide without an extra render pass.
  const index = Math.min(rawIndex, Math.max(total - 1, 0));

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Keep the index valid when the slide set shrinks (e.g. admin ads change).
  // (Handled by deriving `index` above — no effect needed.)

  const paused = hoverPaused || focusPaused || autoplayPaused || reducedMotion;

  useEffect(() => {
    if (paused || total < 2) return;
    const timer = window.setInterval(() => {
      setRawIndex((i) => (i + 1) % total);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [paused, total]);

  const goTo = (i: number) => setRawIndex(((i % total) + total) % total);

  return (
    <section
      aria-label="Medic1905 highlights"
      aria-roledescription="carousel"
      className="mx-auto w-full max-w-5xl px-4"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={() => setFocusPaused(false)}
      data-testid="home-ads-carousel"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div
          className="flex transition-transform duration-500 ease-in-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {items.map((slide, i) => {
            const active = i === index;
            return (
              <Slide key={slide.id} slide={slide} active={active} />
            );
          })}
        </div>

        {total > 1 && (
          // The overlay only carries the buttons: it must not swallow clicks
          // on the slide's call-to-action underneath it.
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous slide"
              data-testid="carousel-prev"
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next slide"
              data-testid="carousel-next"
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {total > 1 && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <div className="flex justify-center gap-2">
            {items.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                data-testid={`carousel-dot-${i}`}
                className={`h-2 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${
                  i === index ? "w-5 bg-foreground" : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground/70"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAutoplayPaused((p) => !p)}
            aria-pressed={autoplayPaused}
            aria-label={autoplayPaused ? "Resume automatic rotation" : "Pause automatic rotation"}
            data-testid="carousel-autoplay-toggle"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {autoplayPaused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      )}
    </section>
  );
}

/** One slide: icon or image, text, and the call-to-action. */
function Slide({ slide, active }: { slide: ImedicsHomeSlide; active: boolean }) {
  const [imageBroken, setImageBroken] = useState(false);
  const Icon = SLIDE_ICONS[slide.icon];

  return (
    <div
      aria-hidden={!active}
      className="flex w-full shrink-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex min-w-0 items-start gap-4 sm:max-w-xl">
        {slide.image && !imageBroken ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic slide images
          <img
            src={slide.image}
            alt=""
            loading="lazy"
            onError={() => setImageBroken(true)}
            className="h-12 w-12 shrink-0 rounded-lg bg-muted object-cover grayscale"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"
          >
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{slide.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{slide.description}</p>
        </div>
      </div>
      {slide.ctaHref && slide.ctaLabel && (
        <Link
          href={slide.ctaHref}
          tabIndex={active ? 0 : -1}
          className="shrink-0 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold transition-colors hover:border-foreground/50 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {slide.ctaLabel}
        </Link>
      )}
    </div>
  );
}
