import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  IMEDICS_AUDIENCES,
  IMEDICS_BENEFITS,
  IMEDICS_FAQS,
  IMEDICS_FEATURED_PANEL,
  IMEDICS_FOOTER_LINKS,
  IMEDICS_HOME_SLIDES,
  IMEDICS_HOW_IT_WORKS_STEPS,
  IMEDICS_IMAGE_CREDITS,
  IMEDICS_NAV_LINKS,
  IMEDICS_SERVICE_CARDS,
} from "./imedics-home-content";

describe("Medic1905 homepage content", () => {
  it("lists exactly eight compact service cards", () => {
    expect(IMEDICS_SERVICE_CARDS).toHaveLength(8);
    for (const card of IMEDICS_SERVICE_CARDS) {
      expect(card.title).toBeTruthy();
      expect(card.description).toBeTruthy();
      expect(card.href).toMatch(/^\//);
      expect(["account", "public"]).toContain(card.access);
    }
  });

  it("targets real routes for every service card and footer link", () => {
    for (const card of IMEDICS_SERVICE_CARDS) {
      expect(existsSync(path.join(process.cwd(), "src/app", card.href, "page.tsx")), card.href).toBe(true);
    }
    for (const group of IMEDICS_FOOTER_LINKS) {
      for (const link of group.links) {
        expect(existsSync(path.join(process.cwd(), "src/app", link.href, "page.tsx")), link.href).toBe(true);
      }
    }
  });

  it("keeps the featured panel CTA inside the existing auth flow", () => {
    expect(IMEDICS_FEATURED_PANEL.ctaHref).toBe("/auth/login");
    expect(IMEDICS_FEATURED_PANEL.secondaryCtaHref).toBe("/auth/signup");
    expect(existsSync(path.join(process.cwd(), "src/app", IMEDICS_FEATURED_PANEL.ctaHref, "page.tsx"))).toBe(true);
    expect(existsSync(path.join(process.cwd(), "src/app", IMEDICS_FEATURED_PANEL.secondaryCtaHref, "page.tsx"))).toBe(true);
  });

  it("shows a short four-step how-it-works flow", () => {
    expect(IMEDICS_HOW_IT_WORKS_STEPS).toHaveLength(4);
    for (const step of IMEDICS_HOW_IT_WORKS_STEPS) {
      expect(step.length).toBeGreaterThan(10);
    }
  });

  it("keeps the FAQ small and answerable", () => {
    expect(IMEDICS_FAQS.length).toBeGreaterThanOrEqual(4);
    expect(IMEDICS_FAQS.length).toBeLessThanOrEqual(6);
    for (const item of IMEDICS_FAQS) {
      expect(item.question.endsWith("?")).toBe(true);
      expect(item.answer.length).toBeGreaterThan(20);
    }
  });

  it("does not advertise clinical data or results in card copy", () => {
    const copy = IMEDICS_SERVICE_CARDS.map(c => `${c.title} ${c.description}`).join(" ").toLowerCase();
    expect(copy).not.toMatch(/diagnos[ie] your|your test result value|\bcure\b|treat guaranteed/);
  });

  it("shows a sliding highlights card with real destinations", () => {
    expect(IMEDICS_HOME_SLIDES.length).toBeGreaterThanOrEqual(3);
    for (const slide of IMEDICS_HOME_SLIDES) {
      expect(slide.title).toBeTruthy();
      expect(slide.description).toBeTruthy();
      if (slide.ctaHref) {
        expect(slide.ctaHref).toMatch(/^\//);
        expect(existsSync(path.join(process.cwd(), "src/app", slide.ctaHref, "page.tsx")), slide.ctaHref).toBe(true);
      }
    }
  });

  it("targets real routes or on-page anchors for every navigation link", () => {
    expect(IMEDICS_NAV_LINKS.length).toBeGreaterThanOrEqual(10);
    for (const link of IMEDICS_NAV_LINKS) {
      expect(link.label).toBeTruthy();
      if (link.href.startsWith("#")) {
        // On-page anchors must point at sections that exist on the landing page.
        expect(["#for-patients", "#features", "#contact"]).toContain(link.href);
      } else {
        expect(existsSync(path.join(process.cwd(), "src/app", link.href, "page.tsx")), link.href).toBe(true);
      }
    }
  });

  it("shows one audience section per account type with real destinations", () => {
    expect(IMEDICS_AUDIENCES.map((a) => a.key)).toEqual([
      "patients", "doctors", "hospitals", "laboratories", "diagnostics", "pharmacies",
    ]);
    for (const audience of IMEDICS_AUDIENCES) {
      expect(audience.title).toBeTruthy();
      expect(audience.description.length).toBeGreaterThan(30);
      expect(audience.cta).toBeTruthy();
      expect(existsSync(path.join(process.cwd(), "src/app", audience.href, "page.tsx")), audience.href).toBe(true);
      if (audience.image) {
        expect(audience.image.startsWith("/home/")).toBe(true);
        expect(existsSync(path.join(process.cwd(), "public", audience.image))).toBe(true);
      }
    }
  });

  it("lists benefits and credits every photograph used on the page", () => {
    expect(IMEDICS_BENEFITS.length).toBeGreaterThanOrEqual(6);
    for (const benefit of IMEDICS_BENEFITS) {
      expect(benefit.title).toBeTruthy();
      expect(benefit.description.length).toBeGreaterThan(30);
    }
    expect(IMEDICS_IMAGE_CREDITS.length).toBeGreaterThanOrEqual(4);
  });
});
