"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar, ChevronLeft, ChevronRight, FlaskConical, FolderOpen, HeartPulse,
  Sparkles, Stethoscope, type LucideIcon,
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
 * component. Auto-advances, pauses on hover/focus, honours
 * prefers-reduced-motion, and supports an optional image per slide
 * (rendered in grayscale to keep the monochrome system).
 */
export function HomeAdsCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const total = IMEDICS_HOME_SLIDES.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || total < 2) return;
    const timer = window.setInterval(() => {
      setIndex(i => (i + 1) % total);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, total]);

  const goTo = (i: number) => setIndex(((i % total) + total) % total);

  return (
    <section
      aria-label="Medic1905 highlights"
      aria-roledescription="carousel"
      className="mx-auto w-full max-w-5xl px-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      data-testid="home-ads-carousel"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div
          className="flex transition-transform duration-500 ease-in-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {IMEDICS_HOME_SLIDES.map((slide, i) => {
            const Icon = SLIDE_ICONS[slide.icon];
            const active = i === index;
            return (
              <div
                key={slide.id}
                aria-hidden={!active}
                className="flex w-full shrink-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div className="flex items-start gap-4 sm:max-w-xl">
                  {slide.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- dynamic slide images
                    <img
                      src={slide.image}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover grayscale"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                  )}
                  <div>
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
          })}
        </div>

        {total > 1 && (
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              aria-label="Previous slide"
              data-testid="carousel-prev"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              aria-label="Next slide"
              data-testid="carousel-next"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {total > 1 && (
        <div className="mt-2 flex justify-center gap-2">
          {IMEDICS_HOME_SLIDES.map((slide, i) => (
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
      )}
    </section>
  );
}
