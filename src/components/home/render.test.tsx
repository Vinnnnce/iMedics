import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { PublicHomepage } from "@/components/home/public-homepage";
import { SpecialtyGrid } from "@/components/home/specialty-grid";
import { StatusChip } from "@/components/shared/status-chip";

/** Render smoke tests: the marketing page must render as HTML without crashing
 *  (e.g. Lucide icons invoked as functions would throw here). */
describe("public homepage rendering", () => {
  it("renders the hero, sections, and footer", () => {
    const html = renderToString(<PublicHomepage />);
    expect(html).toContain("Quality healthcare, wherever you are.");
    expect(html).toContain("How it works");
    expect(html).toContain("Featured specialties");
    expect(html).toContain("Grow your practice with Medic1905.");
    expect(html).toContain("Trust and safety");
    // Emergency guidance is present in the footer.
    expect(html).toContain("112");
    // Exactly one footer with the copyright line.
    expect(html.match(/©/g)?.length).toBe(1);
  });

  it("does not render a second main landmark (the root layout provides one)", () => {
    const html = renderToString(<PublicHomepage />);
    expect(html.match(/<main/g)?.length ?? 0).toBe(0);
  });

  it("renders the specialty search grid with all twelve specialties", () => {
    const html = renderToString(<SpecialtyGrid />);
    expect(html).toContain("Search specialties");
    expect(html).toContain("specialties shown");
    expect(html).toContain("Cardiology");
  });
});

describe("status chip rendering", () => {
  it("renders every tone with an icon so colour is never the only signal", () => {
    for (const tone of ["neutral", "success", "warning", "danger", "info"] as const) {
      const html = renderToString(<StatusChip tone={tone}>{tone} status</StatusChip>);
      expect(html).toContain("status");
      // Lucide icons render as inline SVGs alongside the label.
      expect(html).toMatch(/<svg[^>]*>/);
    }
    expect(renderToString(<StatusChip tone="info">New message</StatusChip>)).toContain("New message");
  });
});