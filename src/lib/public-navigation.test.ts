import { describe, expect, it } from "vitest";
import { isPublicPageHref } from "./public-navigation";
describe("anonymous entry navigation", () => {
  it.each(["/", "/emergency/cpr", "/hospitals/example", "/laboratories", "/diagnostic-centres", "/news", "/podcasts", "/legal/privacy", "/auth/login", "/auth/signup", "#services"])("keeps public route %s eligible for ordinary navigation", (href) => {
    expect(isPublicPageHref(href)).toBe(true);
  });
  it.each(["/doctors", "/doctors/synthetic?q=cardiology", "/facilities", "/patient/consult", "/patient/appointments", "/patient/results", "/pricing", "/unknown-new-private-route"])("uses top-level navigation for protected route %s", (href) => {
    expect(isPublicPageHref(href)).toBe(false);
  });
  it("supports URL objects and public external destinations", () => {
    expect(isPublicPageHref({ pathname: "/patient/consult" })).toBe(false);
    expect(isPublicPageHref({ pathname: "/hospitals" })).toBe(true);
    expect(isPublicPageHref("https://example.com/resource")).toBe(true);
  });
});
