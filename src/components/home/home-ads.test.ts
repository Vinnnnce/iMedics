import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { HomeAdsCarousel } from "@/components/home/home-ads-carousel";
import { HomeSingleAdBanner } from "@/components/home/home-single-ad-banner";
import { IMEDICS_HOME_SLIDES, type ImedicsHomeSlide } from "@/lib/home/imedics-home-content";

/** Render smoke tests for the homepage ad slots: the single banner and the
 * carousel must render (with defaults and with admin-managed ads) without
 * crashing, and the built-in defaults must never leave a slot empty.
 * (Written with createElement because the vitest include pattern is *.test.ts.) */
describe("homepage ads", () => {
  it("renders the single ad banner with its built-in default", () => {
    const html = renderToString(createElement(HomeSingleAdBanner));
    expect(html).toContain("Sponsored banner");
    expect(html).toContain("Medic1905 for organizations");
    expect(html).toContain("Explore facilities");
  });

  it("renders an active HOMEPAGE_BANNER ad instead of the default", () => {
    const html = renderToString(
      createElement(HomeSingleAdBanner, { ad: { title: "Flu season", content: "Book a lab test near you." } }),
    );
    expect(html).toContain("Flu season");
    expect(html).toContain("Book a lab test near you.");
    expect(html).not.toContain("Medic1905 for organizations");
  });

  it("falls back to the default when the ad content is blank", () => {
    const html = renderToString(createElement(HomeSingleAdBanner, { ad: { title: "  ", content: "" } }));
    expect(html).toContain("Medic1905 for organizations");
  });

  it("renders the carousel with its built-in slides", () => {
    const html = renderToString(createElement(HomeAdsCarousel));
    expect(html).toContain("home-ads-carousel");
    // Titles are HTML-escaped (& becomes &), so assert on safe substrings.
    expect(html).toContain("Find a verified doctor");
    expect(html).toContain("Lab results in one place");
    expect(html).toContain("AI health assistant");
    expect(IMEDICS_HOME_SLIDES.length).toBe(4);
  });

  it("renders admin-managed carousel ads instead of the built-in slides", () => {
    const slides: ImedicsHomeSlide[] = [
      { id: "ad-0", title: "Sponsored: lab tests", description: "20% off this month.", ctaHref: "/facilities", ctaLabel: "Explore facilities", icon: "sparkles" },
    ];
    const html = renderToString(createElement(HomeAdsCarousel, { slides }));
    expect(html).toContain("Sponsored: lab tests");
    expect(html).not.toContain("Find a verified doctor");
  });

  it("renders one pagination dot per actual slide, not per built-in slide", () => {
    // Regression: the dots used to map over IMEDICS_HOME_SLIDES, so admin-managed
    // ads got the wrong number of dots (and wrong targets).
    const slides: ImedicsHomeSlide[] = [
      { id: "ad-0", title: "Ad one", description: "First.", icon: "sparkles" },
      { id: "ad-1", title: "Ad two", description: "Second.", icon: "flask" },
    ];
    const html = renderToString(createElement(HomeAdsCarousel, { slides }));
    expect(html).toContain("carousel-dot-0");
    expect(html).toContain("carousel-dot-1");
    expect(html).not.toContain("carousel-dot-2");
    // The autoplay pause control renders alongside the dots.
    expect(html).toContain("carousel-autoplay-toggle");
  });

  it("hides carousel controls when there is a single slide", () => {
    const slides: ImedicsHomeSlide[] = [
      { id: "ad-0", title: "Only ad", description: "One.", icon: "sparkles" },
    ];
    const html = renderToString(createElement(HomeAdsCarousel, { slides }));
    expect(html).toContain("Only ad");
    expect(html).not.toContain("carousel-prev");
    expect(html).not.toContain("carousel-next");
    expect(html).not.toContain("carousel-autoplay-toggle");
  });

  it("keeps the previous/next overlay from swallowing slide clicks", () => {
    const html = renderToString(createElement(HomeAdsCarousel));
    // The full-slide overlay is pointer-events-none; only the buttons opt back in.
    expect(html).toContain("pointer-events-none");
    expect(html).toContain("pointer-events-auto");
  });
});
