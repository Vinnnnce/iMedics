import { describe, expect, it } from "vitest";
import {
  parseWebsiteLayout,
  layoutFromTemplate,
  moveBlock,
  newWebsiteBlock,
  validateAddOns,
  websiteLayoutSchema,
} from "./blocks";

describe("website layout schema", () => {
  it("accepts an empty layout and fills defaults", () => {
    const layout = parseWebsiteLayout({ version: 1, blocks: [] });
    expect(layout.blocks).toEqual([]);
  });

  it("rejects unknown block types", () => {
    expect(() =>
      parseWebsiteLayout({ version: 1, blocks: [{ id: "00000000-0000-4000-8000-000000000000", type: "nope", settings: {} }] }),
    ).toThrow();
  });

  it("rejects duplicate block ids", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const block = { id, type: "about", settings: {} };
    expect(() => parseWebsiteLayout({ version: 1, blocks: [block, block] })).toThrow(/Duplicate/i);
  });

  it("rejects settings that fail per-type validation", () => {
    const block = { id: "00000000-0000-4000-8000-000000000000", type: "banner", settings: { heading: "x".repeat(500) } };
    expect(() => parseWebsiteLayout({ version: 1, blocks: [block] })).toThrow(/banner/i);
  });

  it("normalizes valid settings", () => {
    const layout = parseWebsiteLayout({
      version: 1,
      blocks: [{ id: "00000000-0000-4000-8000-000000000000", type: "about", settings: { title: "  Hello  " } }],
    });
    expect(layout.blocks[0].settings).toMatchObject({ title: "Hello" });
  });

  it("bounds the number of blocks", () => {
    const blocks = Array.from({ length: 41 }, (_, i) => ({
      id: `0000000${i.toString().padStart(2, "0")}-0000-4000-8000-000000000000`,
      type: "about",
      settings: {},
    }));
    expect(() => parseWebsiteLayout({ version: 1, blocks })).toThrow();
    expect(websiteLayoutSchema.safeParse({ version: 2, blocks: [] }).success).toBe(false);
  });
});

describe("block ordering", () => {
  const mk = () => [newWebsiteBlock("banner"), newWebsiteBlock("about"), newWebsiteBlock("hours")];

  it("moves blocks up and down with clamping", () => {
    const blocks = mk();
    const moved = moveBlock(blocks, 2, -1);
    expect(moved.map((b) => b.type)).toEqual(["banner", "hours", "about"]);
    // Clamped: moving the first block up or the last block down changes nothing.
    expect(moveBlock(blocks, 0, -1).map((b) => b.type)).toEqual(["banner", "about", "hours"]);
    expect(moveBlock(blocks, 2, 1).map((b) => b.type)).toEqual(["banner", "about", "hours"]);
  });

  it("does not mutate the input", () => {
    const blocks = mk();
    moveBlock(blocks, 0, 1);
    expect(blocks[0].type).toBe("banner");
  });
});

describe("templates and add-ons", () => {
  it("builds a starter layout from a template key", () => {
    const layout = layoutFromTemplate("clinic-lite");
    expect(layout.blocks.map((b) => b.type)).toContain("banner");
    expect(layout.blocks.every((b) => b.id && !b.hidden)).toBe(true);
  });

  it("falls back to the default template for unknown keys", () => {
    const layout = layoutFromTemplate("does-not-exist");
    expect(layout.blocks.length).toBeGreaterThan(5);
  });

  it("requires the matching add-on for gated blocks", () => {
    const cta = [newWebsiteBlock("cta")];
    expect(() => validateAddOns(cta, [])).toThrow(/add-on/i);
    expect(() => validateAddOns(cta, ["cta-banner"])).not.toThrow();
  });
});
