"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COOKIE_CONSENT_EVENT, OPTIONAL_CATEGORIES, readCookieConsent, saveCookieConsent, type CookieConsent } from "@/lib/cookie-consent";

const OPEN_EVENT = "medic1905:cookie-settings";
export function CookieSettingsButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs underline underline-offset-4"><Cookie className="size-4" aria-hidden="true" />Cookie settings</button>;
}
export function CookiePreferences() {
  const [openOverride, setOpen] = useState<boolean | null>(null);
  const storedConsent = useSyncExternalStore(
    callback => { window.addEventListener(COOKIE_CONSENT_EVENT, callback); window.addEventListener("storage", callback); return () => { window.removeEventListener(COOKIE_CONSENT_EVENT, callback); window.removeEventListener("storage", callback); }; },
    () => JSON.stringify(readCookieConsent()),
    () => "pending",
  );
  const open = openOverride ?? (storedConsent !== "pending" && storedConsent === "null");
  const [customize, setCustomize] = useState(false);
  const [choices, setChoices] = useState({ preferences: false, analytics: false, performance: false, marketing: false });
  const first = useRef<HTMLButtonElement>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const reopen = () => { const consent = readCookieConsent(); if (consent) setChoices(consent); setOpen(true); setCustomize(true); setSaved(false); };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);
  useEffect(() => { if (open) first.current?.focus({ preventScroll: true }); }, [open]);
  function save(all?: boolean) {
    const selected = all === undefined ? choices : { preferences: all, analytics: all, performance: all, marketing: all };
    const consent: CookieConsent = { ...selected, essential: true, version: 1, savedAt: new Date().toISOString() };
    saveCookieConsent(consent);
    setChoices(selected); setOpen(false); setSaved(true);
  }
  return <>
    {!open && <div className="experience-settings"><CookieSettingsButton /></div>}
    {saved && <p role="status" className="sr-only">Cookie preferences saved. Reopen Cookie settings to change them.</p>}
    {open && <section aria-label="Cookie preferences" className="cookie-panel" onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}>
      <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Your privacy, your choice</h2><button ref={first} type="button" aria-label="Close cookie settings without changing choices" onClick={() => setOpen(false)} className="grid size-11 shrink-0 place-items-center"><X className="size-4" /></button></div>
      <p className="my-4 text-sm leading-relaxed text-muted-foreground">Essential authentication and security storage keeps Medic1905 working. Optional processing is off until you choose. No analytics, performance or marketing trackers are currently installed.</p>
      {customize && <div className="mb-5 space-y-4">
        <p className="text-sm">Essential, authentication and security: always active.</p>
        {OPTIONAL_CATEGORIES.map(category => <label key={category} className="flex min-h-11 items-center justify-between gap-4 text-sm capitalize">{category}{category !== "preferences" ? " (not installed)" : ""}
          <input type="checkbox" className="size-5 accent-foreground" checked={choices[category]} onChange={e => setChoices(previous => ({ ...previous, [category]: e.target.checked }))} />
        </label>)}
      </div>}
      <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => save(false)}>Reject optional</Button><Button variant="outline" onClick={() => save(true)}>Accept all</Button></div>
      <div className="mt-3 flex flex-wrap justify-between gap-2"><Button variant="ghost" onClick={() => setCustomize(!customize)}>{customize ? "Hide categories" : "Customize"}</Button>{customize && <Button onClick={() => save()}>Save preferences</Button>}</div>
      <a className="mt-3 block text-xs underline underline-offset-4" href="/legal/cookies">Read the Cookie Policy</a>
    </section>}
  </>;
}
