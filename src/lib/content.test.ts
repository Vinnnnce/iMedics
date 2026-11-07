import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { bodyParagraphs, nextPublishedAt, optionalHttpsUrl, slugify } from "@/lib/content";

describe("slugify", () => {
  it("makes a lower-case ASCII slug", () => {
    expect(slugify("  Malaria: Prevention & Care! ")).toBe("malaria-prevention-care");
    expect(slugify("Café Santé")).toBe("cafe-sante");
  });
  it("never returns an empty slug", () => {
    expect(slugify("!!!")).toBe("item");
  });
});

describe("nextPublishedAt", () => {
  const earlier = new Date("2026-01-01T00:00:00Z");
  it("leaves the date alone when the status is not being changed", () => {
    expect(nextPublishedAt(undefined, earlier)).toBeUndefined();
  });
  it("stamps the first publish and keeps it afterwards", () => {
    expect(nextPublishedAt("PUBLISHED", null)).toBeInstanceOf(Date);
    expect(nextPublishedAt("PUBLISHED", earlier)).toBe(earlier);
  });
  it("clears the date for drafts and keeps it for archived items", () => {
    expect(nextPublishedAt("DRAFT", earlier)).toBeNull();
    expect(nextPublishedAt("ARCHIVED", earlier)).toBe(earlier);
  });
});

describe("bodyParagraphs", () => {
  it("splits on blank lines and drops empties", () => {
    expect(bodyParagraphs("One\n\n\nTwo\nstill two\n\n  \n")).toEqual(["One", "Two\nstill two"]);
  });
});

describe("optionalHttpsUrl", () => {
  it("accepts https URLs and maps empty to null", () => {
    expect(optionalHttpsUrl.parse("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(optionalHttpsUrl.parse("")).toBeNull();
    expect(optionalHttpsUrl.parse(null)).toBeNull();
    expect(optionalHttpsUrl.parse(undefined)).toBeNull();
  });
  it("rejects http and script URLs", () => {
    expect(() => optionalHttpsUrl.parse("http://example.com/a.png")).toThrow();
    expect(() => optionalHttpsUrl.parse("javascript:alert(1)")).toThrow();
  });
});
