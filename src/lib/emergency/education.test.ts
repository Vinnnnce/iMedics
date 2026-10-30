import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { EmergencyEducation } from "@/components/emergency/emergency-education";
import { emergencyGuides, emergencyVideos } from "./education";
import { EMERGENCY_BANNER } from "./content";

describe("emergency education", () => {
  it("covers nine topics with accessible illustration descriptions", () => {
    expect(emergencyGuides).toHaveLength(9);
    expect(new Set(emergencyGuides.map((g) => g.id)).size).toBe(9);
    emergencyGuides.forEach((g) => {
      expect(g.alt.length).toBeGreaterThan(30);
      expect(g.source).toMatch(/^https:\/\//);
    });
  });
  it("contains eight distinct publisher video references", () => {
    expect(emergencyVideos).toHaveLength(8);
    expect(new Set(emergencyVideos.map((v) => v.id)).size).toBe(8);
    emergencyVideos.forEach((v) => expect(v.id).toMatch(/^[A-Za-z0-9_-]{11}$/));
  });
  it("does not load iframes before interaction and preserves external links", () => {
    const html = renderToStaticMarkup(createElement(EmergencyEducation));
    expect(html).not.toContain("<iframe");
    emergencyVideos.forEach((v) => expect(html).toContain(`https://www.youtube.com/watch?v=${v.id}`));
    expect((html.match(/role="img"/g) ?? []).length).toBe(9);
    expect(html).toContain('loading="lazy"');
  });
  it("preserves the exact safety notice without universal emergency numbers", () => {
    expect(EMERGENCY_BANNER.body).toBe("Educational information is not a substitute for professional medical care. In a life-threatening emergency, contact your local emergency services immediately. Do not delay emergency assistance to watch a video or use this website.");
    expect(EMERGENCY_BANNER.body).not.toMatch(/\b(112|911|999)\b/);
  });
});
