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
  it("uses document navigation for anonymous clicks, not a failed cross-origin RSC fetch", () => {
    const source = readFileSync("src/components/layout/navbar.tsx", "utf8");
    expect(source).toContain("event.preventDefault()");
    expect(source).toContain("window.location.assign(href)");
    for (const tag of source.match(/<Link\b[^>]*>/g) ?? []) {
      expect(tag).toContain("onNavigate={anonymousNavigation(");
    }
  });
  it("keeps facility managers' website navigation tenant-scoped", () => {
    const source = readFileSync("src/components/layout/navbar.tsx", "utf8");
    expect(source).toContain('permission: "MANAGE_PROFILE"');
    expect(source).toContain("FACILITY_SECTIONS");
    expect(source).toContain("/lab/website?facilityId=${encodeURIComponent(facility.id)}");
  });
  it("groups navigation into role sections and gates facility modules by kind", () => {
    const source = readFileSync("src/components/layout/navbar.tsx", "utf8");
    // The doctor menu is the simplified four-section interface.
    expect(source).toContain('label: "Doctor Dashboard"');
    expect(source).toContain('label: "AI Tools"');
    // Facility modules are grouped and gated per registered facility type.
    expect(source).toContain('label: "Laboratory"');
    expect(source).toContain('kinds: ["HOSPITAL", "LABORATORY"]');
    expect(source).toContain('label: "Our Staff"');
    expect(source).toContain('label: "Cashier & Billing"');
    // No doctor link may point into the facility portal and vice versa.
    const doctorSection = source.slice(source.indexOf("const DOCTOR_SECTIONS"), source.indexOf("const FACILITY_DASHBOARD_ITEM"));
    expect(doctorSection).not.toContain('"/lab/');
  });
  it("logs every account type out to the public landing page", () => {
    for (const file of ["src/components/shared/sign-out-button.tsx", "src/components/profile-form.tsx", "src/components/post-signup-redirect.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain('signOut({ redirectUrl: "/" })');
      expect(source).not.toContain('redirectUrl: "/auth/login"');
    }
  });
});
