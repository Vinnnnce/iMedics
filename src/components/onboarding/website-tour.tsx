"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/use-me";
import { buildTourSteps, PUBLIC_TOUR, type TourLink } from "@/lib/tour";

type Status = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
export function WebsiteTour({ links = [], publicTour = false, compact = false }: { links?: readonly TourLink[]; publicTour?: boolean; compact?: boolean }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const steps = useMemo(() => publicTour ? PUBLIC_TOUR : buildTourSteps(links), [links, publicTour]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const eligible = Boolean(me?.onboardingComplete && me.status === "ACTIVE" && steps.length);
  useEffect(() => {
    const restart = () => trigger.current?.click();
    window.addEventListener("medic1905:tour", restart);
    return () => window.removeEventListener("medic1905:tour", restart);
  }, []);

  const persist = useCallback((status: Status, step: number) => {
    if (publicTour) {
      try { sessionStorage.setItem("medic1905.public-tour", JSON.stringify({ status, step })); } catch { /* optional */ }
      return Promise.resolve(true);
    }
    // Serialise progress writes so a slow Next request cannot overwrite Finish.
    const operation = queue.current.catch(() => {}).then(async () => {
      const response = await fetch("/api/me/tour", { method: "PATCH", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, step }) });
      if (!response.ok) throw new Error("Tour progress could not be saved. You can restart the tour from Help & Tour.");
    });
    queue.current = operation.catch(() => {});
    return operation.then(() => true).catch((cause: Error) => { setError(cause.message); return false; });
  }, [publicTour]);
  useEffect(() => {
    if (publicTour || !eligible) return;
    let cancelled = false;
    fetch("/api/me/tour").then(async response => {
      if (!response.ok) throw new Error();
      const saved: { status: Status; step: number } = await response.json();
      if (cancelled) return;
      if (saved.status === "NOT_STARTED" || saved.status === "IN_PROGRESS") {
        setIndex(Math.min(saved.step, steps.length - 1)); setOpen(true);
        if (saved.status === "NOT_STARTED") persist("IN_PROGRESS", 0);
      }
    }).catch(() => { /* Never interrupt on failed state retrieval; manual restart remains available. */ });
    return () => { cancelled = true; };
  }, [eligible, me?.id, me?.role, me?.status, persist, publicTour, steps.length]);
  useEffect(() => {
    if (!open) return;
    heading.current?.focus({ preventScroll: true });
    const href = steps[index]?.href;
    const candidates = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")];
    const target = candidates.find(link => link.getAttribute("href") === href && link.getBoundingClientRect().width > 0 && !link.closest(".tour-panel"));
    if (target) {
      target.classList.add("tour-highlight");
      target.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
    return () => target?.classList.remove("tour-highlight");
  }, [open, index, steps, pathname]);
  async function close(status: Status) {
    if (saving) return;
    setSaving(true);
    const saved = await persist(status, index);
    setSaving(false);
    if (!saved) return;
    setOpen(false);
    if (trigger.current?.getBoundingClientRect().width) trigger.current.focus();
    else document.querySelector<HTMLElement>('[aria-label="Open profile menu"]')?.focus();
  }
  function start() { setIndex(0); setError(""); setOpen(true); persist("IN_PROGRESS", 0); }
  function move(next: number) { setIndex(next); persist("IN_PROGRESS", next); }
  const step = steps[index];
  return <>
    <button ref={trigger} type="button" onClick={start} className={`${compact ? "hidden sm:inline-flex" : "inline-flex"} min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-muted`} aria-label="Help & Tour"><Compass className="size-5" aria-hidden="true" /><span className="hidden sm:inline">Help & Tour</span></button>
    {open && step && createPortal(<section className="tour-panel" role="region" aria-label="Guided website tour" onKeyDown={e => { if (e.key === "Escape") close("SKIPPED"); }}>
      <div className="flex items-center justify-between gap-4"><span className="text-xs text-muted-foreground">{publicTour ? "Discover Medic1905" : "Your workspace tour"} · {index + 1} of {steps.length}</span><button type="button" disabled={saving} aria-label="Skip tour" onClick={() => close("SKIPPED")} className="grid size-11 place-items-center"><X className="size-4" /></button></div>
      <progress className="mb-5 h-1 w-full accent-foreground" value={index + 1} max={steps.length} aria-label="Tour progress" />
      <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold">{index === 0 && !publicTour ? `Welcome. ${step.label}` : step.label}</h2>
      <p className="my-4 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
      <Button variant="outline" disabled={saving} onClick={async () => { setSaving(true); const saved = await persist("IN_PROGRESS", index); setSaving(false); if (saved) router.push(step.href); }}>Open {step.label}</Button>
      {saving && <p role="status" className="mt-3 text-xs text-muted-foreground">Saving tour progress…</p>}
      {error && <div className="mt-3 text-xs"><p role="alert" className="text-destructive">{error}</p><button className="min-h-11 underline" onClick={() => setOpen(false)}>Dismiss without saving</button></div>}
      <div className="mt-6 flex items-center justify-between gap-2">
        <Button variant="ghost" disabled={saving} onClick={() => close("SKIPPED")}>Skip</Button>
        <div className="flex gap-2"><Button variant="outline" disabled={saving || index === 0} onClick={() => move(index - 1)}>Previous</Button>{index === steps.length - 1 ? <Button disabled={saving} onClick={() => close("COMPLETED")}>Finish</Button> : <Button disabled={saving} onClick={() => move(index + 1)}>Next</Button>}</div>
      </div>
    </section>, document.body)}
  </>;
}
