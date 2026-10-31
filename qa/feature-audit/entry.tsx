/** Isolated component harness. Synthetic facility and browser-local persistence.
 * Never part of the Next.js application or used as production account data.
 */
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { EmergencyCentre } from "../../src/components/emergency/emergency-centre";
import { EmergencyModuleView } from "../../src/components/emergency/emergency-module";
import { WebsiteBuilder } from "../../src/components/website/builder";
import { WEBSITE_TEMPLATES, WEBSITE_ADDONS } from "../../src/lib/website/blocks";

const mode = new URLSearchParams(location.search).get("mode");
const screen = new URLSearchParams(location.search).get("screen") ?? "emergency";
const fixture = {
  id: "qa-facility-only", slug: "qa-clinic", directory: "laboratories", isPublic: true,
  name: "QA Test Laboratory", phone: "000000000", email: "qa@example.invalid",
  address: "Synthetic QA address", city: "Test city", state: "Test state", operatingHours: "9–5",
};
const storageKey = "imedics.feature-audit.website";
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, options) => {
  const url = String(input);
  if (!url.startsWith("/api/")) return originalFetch(input, options);
  if (!url.startsWith("/api/facility/website?facilityId=qa-facility-only")) return Response.json({ error: "Unexpected endpoint" }, { status: 404 });
  if (mode === "forbidden") return Response.json({ error: "Your role does not allow this action" }, { status: 403 });
  if (mode === "error") return Response.json({ error: "Test network failure. Please retry." }, { status: 503 });
  if (mode === "loading") return new Promise(() => {});
  let website = JSON.parse(localStorage.getItem(storageKey) ?? "null") ?? { id: "qa-website", template: "clinic-lite", draftLayout: { version: 1, blocks: [] }, publishedLayout: null, addOns: [], draftSavedAt: null, publishedAt: null };
  if (options?.method === "PUT") {
    if (mode === "save-error") return Response.json({ error: "Test save failed. Retry your draft." }, { status: 503 });
    const body = JSON.parse(String(options.body));
    website = { ...website, template: body.template, draftLayout: body.layout, addOns: body.addOns, draftSavedAt: new Date().toISOString() };
  }
  if (options?.method === "POST") website = { ...website, publishedLayout: website.draftLayout, publishedAt: new Date().toISOString() };
  localStorage.setItem(storageKey, JSON.stringify(website));
  return Response.json({ website, templates: WEBSITE_TEMPLATES, addOns: WEBSITE_ADDONS });
};
createRoot(document.getElementById("root")!).render(
  <main className="mx-auto min-w-0 max-w-6xl p-3 sm:p-6" style={{ fontFamily: "Arial, sans-serif" }}>
    <p className="mb-5 rounded border border-border p-2 text-sm">Isolated QA harness. Facility data and persistence are synthetic, not a real account.</p>
    {screen === "website" ? <WebsiteBuilder facility={fixture} /> : screen === "module" ? <EmergencyModuleView moduleId={new URLSearchParams(location.search).get("id") ?? ""} /> : <EmergencyCentre />}
    <Toaster />
  </main>
);
