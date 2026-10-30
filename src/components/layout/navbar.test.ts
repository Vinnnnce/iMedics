import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("anonymous navigation prefetch regression", () => {
  it("does not speculatively fetch protected navigation before sign-in", () => {
    const source = readFileSync("src/components/layout/navbar.tsx", "utf8");
    expect(source).toContain("const navigationPrefetch = user ? undefined : false");
    const links = source.match(/<Link\b[^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(5);
    for (const tag of links) expect(tag).toContain("prefetch={navigationPrefetch}");
  });
  it("keeps facility managers' website navigation tenant-scoped", () => {
    const source = readFileSync("src/components/layout/navbar.tsx", "utf8");
    expect(source).toContain('permission: "MANAGE_PROFILE"');
    expect(source).toContain("...FACILITY_COMMON_NAV, FACILITY_WEBSITE_ITEM");
    expect(source).toContain("/lab/website?facilityId=${encodeURIComponent(facility.id)}");
  });
});
