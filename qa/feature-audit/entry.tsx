/** Isolated component harness. Synthetic facility and browser-local persistence.
 * Never part of the Next.js application or used as production account data.
 */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { EmergencyCentre } from "../../src/components/emergency/emergency-centre";
import { EmergencyModuleView } from "../../src/components/emergency/emergency-module";
import { WebsiteBuilder } from "../../src/components/website/builder";
import { WEBSITE_TEMPLATES, WEBSITE_ADDONS } from "../../src/lib/website/blocks";
import { OrganizationManager } from "../../src/components/lab/organization-manager";
import { PlatformControl } from "../../src/components/admin/platform-control";
import { AdminNav } from "../../src/components/admin/admin-nav";

const mode = new URLSearchParams(location.search).get("mode");
const screen = new URLSearchParams(location.search).get("screen") ?? "emergency";
document.body.style.fontFamily = "Arial, sans-serif";
const fixture = {
  id: "qa-facility-only", slug: "qa-clinic", directory: "laboratories", isPublic: true,
  name: "QA Test Laboratory", phone: "000000000", email: "qa@example.invalid",
  address: "Synthetic QA address", city: "Test city", state: "Test state", operatingHours: "9–5",
};
const storageKey = "imedics.feature-audit.website";
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, options) => {
  const url = String(input);
  const detail = url.match(/\/api\/facility\/staff\/([0-9a-f-]{36})\/(access|privileges)/i);
  if (detail && (!options?.method || options.method === "GET")) {
    const r = await originalFetch("/organization-staff-acceptance.json");
    return Response.json((await r.json())[detail[1]][detail[2]]);
  }
  if (url.includes("/api/facility/organization") && (!options?.method || options.method === "GET")) {
    const r = await originalFetch("/organization-acceptance.json");
    return new Response(JSON.stringify((await r.json()).payload), { status: r.status, headers: { "Content-Type": "application/json" } });
  }
  if (url.includes("/api/admin/control") && (!options?.method || options.method === "GET")) return originalFetch("/control-acceptance.json");
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
function OrganizationAcceptance() {
  const [id, setId] = useState("");
  useEffect(() => { void originalFetch("/organization-acceptance.json").then((r) => r.json()).then((r) => setId(r.facilityId)); }, []);
  return id ? <OrganizationManager facilities={[{ id, name: "Synthetic Acceptance Hospital A" }]} /> : <p role="status">Loading acceptance fixture…</p>;
}
createRoot(document.getElementById("root")!).render(screen === "organization" || screen === "master-control" ?
  <div className="min-h-screen bg-background text-foreground">
    <div className="border-b bg-muted px-4 py-3 text-xs">Local component QA. Synthetic PostgreSQL acceptance fixtures; not a signed-in production session. Backend mutations tested separately.</div>
    <div className={`mx-auto min-w-0 max-w-[1440px] ${screen === "master-control" ? "grid lg:grid-cols-[13rem_minmax(0,1fr)]" : ""}`}>{screen === "master-control" && <aside className="min-w-0 p-4"><div className="mb-4 text-lg font-semibold">Medic1905</div><AdminNav pending={0} /></aside>}<main className="min-w-0 p-4 lg:p-8">{screen === "organization" ? <OrganizationAcceptance /> : <PlatformControl />}</main></div><Toaster />
  </div> :
  <main className="mx-auto min-w-0 max-w-6xl p-3 sm:p-6" style={{ fontFamily: "Arial, sans-serif" }}>
    <p className="mb-5 rounded border border-border p-2 text-sm">Isolated QA harness. Facility data and persistence are synthetic, not a real account.</p>
    {screen === "website" ? <WebsiteBuilder facility={fixture} /> : screen === "module" ? <EmergencyModuleView moduleId={new URLSearchParams(location.search).get("id") ?? ""} /> : <EmergencyCentre />}
    <Toaster />
  </main>
);
