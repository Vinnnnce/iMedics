import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { visibleNavigation } from "@/lib/navigation-visibility";

const source = readFileSync("src/components/layout/navbar.tsx", "utf8");

describe("application shell", () => {
  it("renders the page content it wraps", () => {
    expect(source).toContain("export function Navbar({ children }");
    expect(source).toContain('<main id="main-content"');
    expect(source).toContain("{children}");
  });
  it("offers a skip link and labelled landmarks", () => {
    expect(source).toContain('href="#main-content"');
    expect(source).toContain('aria-label="Primary"');
    expect(source).toContain('aria-label="Quick links"');
  });
  it("does not render a second header on pages that bring their own shell", () => {
    expect(source).toContain('pathname === "/" && !signedIn');
    expect(source).toContain('pathname === "/workspace"');
  });
  it("only links anonymous visitors to routes that exist and are public", () => {
    for (const href of ["/about", "/pricing", "/help", "/contact"]) expect(source).toContain(`href: "${href}"`);
    expect(source).not.toContain('"/services"');
  });
  it("never prefetches protected links for anonymous visitors", () => {
    expect(source).toContain("me || isPublicPageHref(href) ? undefined : false");
  });
  it("logs out through the shared sign-out button (returns to the landing page)", () => {
    expect(source).toContain("SignOutButton");
  });
});

describe("facility menu by organisation kind", () => {
  const hrefs = (kind: "HOSPITAL" | "LABORATORY" | "DIAGNOSTIC_CENTRE" | "PHARMACY") =>
    visibleNavigation("LAB_SCIENTIST", kind).map((i) => i.href);
  it("shows hospital modules only to hospitals", () => {
    expect(hrefs("HOSPITAL")).toContain("/lab/admissions");
    for (const kind of ["LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"] as const) expect(hrefs(kind)).not.toContain("/lab/admissions");
  });
  it("keeps laboratory and diagnostic work queues separate", () => {
    expect(hrefs("LABORATORY")).toContain("/lab/specimens");
    expect(hrefs("LABORATORY")).not.toContain("/lab/examinations");
    expect(hrefs("DIAGNOSTIC_CENTRE")).toContain("/lab/examinations");
    expect(hrefs("DIAGNOSTIC_CENTRE")).not.toContain("/lab/specimens");
  });
  it("gives pharmacies the pharmacy module and the shared management pages", () => {
    expect(hrefs("PHARMACY")).toContain("/lab/pharmacy");
    expect(hrefs("PHARMACY")).toContain("/lab/staff-management");
  });
  it("does not touch other roles' menus", () => {
    expect(visibleNavigation("DOCTOR", "HOSPITAL").every((i) => !i.href.startsWith("/lab/"))).toBe(true);
  });
});

describe("administrator menu", () => {
  it("is built from the shared admin link list, including Support", () => {
    const hrefs = visibleNavigation("ADMIN", null).map((i) => i.href);
    expect(hrefs).toContain("/admin/support");
    expect(hrefs).toContain("/admin/verifications");
    expect(hrefs.some((h) => h.startsWith("/patient"))).toBe(false);
  });
});
