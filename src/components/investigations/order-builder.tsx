"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, BookmarkPlus, ChevronRight, Clock, Loader2, Plus, Search, ShieldCheck, Sparkles, Star, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, ApiError } from "@/lib/api-client";
import { ELECTRONIC_AUTHORISATION_STATEMENT, PRIORITY_LABEL } from "@/lib/investigations/constants";
import { fieldClass } from "./badges";

export interface BuilderPatient {
  id: string;
  name: string;
  caseNumber: string;
  dateOfBirth: string;
  age: number;
  sex: string;
  allergies: string[];
  encounter: string | null;
}

interface FacilityOption { facilityId: string; name: string; city: string | null; state: string | null; priceMinor: number | null; turnaroundMinutes: number | null }
interface CatalogueItem {
  id: string; name: string; commonName: string | null; abbreviation: string | null; subcategory: string | null; code: string; loincCode: string | null; snomedCode: string | null;
  dicomModality: string | null; standardCodesVerified: boolean; specimenType: string | null; modality: string | null; preparation: string | null; turnaroundMinutes: number | null;
  indicationGuidance: string | null; isPanel: boolean; category: { id: string; key: string; name: string }; facilities: FacilityOption[];
}
interface Category { id: string; key: string; name: string; description: string | null; itemCount: number }
interface Selected { key: string; item?: CatalogueItem; custom?: CustomDetails; facilityId?: string; instructions?: string; duplicateReason?: string }
interface CustomDetails { name: string; discipline?: string; specimenType?: string; bodySite?: string; clinicalIndication?: string; relevantHistory?: string; requirements?: string; requestedDepartment?: string; comments?: string }
interface Duplicate { catalogueItemId: string; name: string; matchedOrderNumber: string; matchedName: string; requestedAt: string; reason: "SAME_INVESTIGATION" | "COVERED_BY_PANEL" }
interface OrderSets { sets: { id: string; name: string; mine: boolean; members: { id: string; name: string }[] }[]; templates: { name: string; members: { id: string; name: string }[] }[] }

export interface InitialDraft {
  id: string; patientId: string; priority: "ROUTINE" | "URGENT" | "EMERGENCY"; clinicalIndication: string; diagnosis: string; clinicalNotes: string; referringDepartment: string;
  items: { catalogueItemId?: string; custom?: CustomDetails; preferredFacilityId?: string; instructions?: string; duplicateOverrideReason?: string }[];
}

interface Props {
  domain: "LABORATORY" | "DIAGNOSTIC";
  patients: BuilderPatient[];
  initialPatientId?: string;
  doctorName: string;
  groups: { title: string; keys: string[] }[] | null;
  draft?: InitialDraft;
}

const UNLISTED_LABEL = { LABORATORY: "Other laboratory analysis", DIAGNOSTIC: "Other diagnostic procedure" } as const;

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function OrderBuilder({ domain, patients, initialPatientId, doctorName, groups, draft }: Props) {
  const router = useRouter();
  const [patientId, setPatientId] = useState(draft?.patientId ?? initialPatientId ?? "");
  const patient = patients.find((p) => p.id === patientId) ?? null;

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query);
  const [mode, setMode] = useState<"browse" | "frequent" | "recent">("browse");
  const [letter, setLetter] = useState<string | null>(null);
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [dupState, setDuplicates] = useState<Duplicate[]>([]);
  const [sets, setSets] = useState<OrderSets | null>(null);
  const [aiMatches, setAiMatches] = useState<{ id: string; name: string; reason: string }[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const [priority, setPriority] = useState<"ROUTINE" | "URGENT" | "EMERGENCY">(draft?.priority ?? "ROUTINE");
  const [indication, setIndication] = useState(draft?.clinicalIndication ?? "");
  const [diagnosis, setDiagnosis] = useState(draft?.diagnosis ?? "");
  const [notes, setNotes] = useState(draft?.clinicalNotes ?? "");
  const [department, setDepartment] = useState(draft?.referringDepartment ?? "");
  const [authorised, setAuthorised] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "submit">(null);
  const [draftId, setDraftId] = useState(draft?.id);
  const hydrated = useRef(false);

  // ---- catalogue loading -------------------------------------------------
  useEffect(() => {
    apiClient.get<{ categories: Category[] }>(`/investigations/categories?domain=${domain}`).then((r) => setCategories(r.categories)).catch(() => toast.error("Could not load the catalogue"));
    apiClient.get<OrderSets>(`/investigations/order-sets?domain=${domain}`).then(setSets).catch(() => undefined);
  }, [domain]);

  useEffect(() => {
    const params = new URLSearchParams({ domain, mode });
    if (debounced.trim()) params.set("q", debounced.trim());
    else if (mode === "browse") { if (categoryId) params.set("categoryId", categoryId); if (letter) params.set("letter", letter); }
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setLoading(true); });
    apiClient.get<{ items: CatalogueItem[] }>(`/investigations/catalogue?${params}`).then((r) => { if (!cancelled) setItems(r.items); }).catch(() => { if (!cancelled) toast.error("Search failed"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [domain, debounced, categoryId, mode, letter]);

  // Restore a saved draft: resolve its catalogue items (with live facility options) by id.
  useEffect(() => {
    if (!draft || hydrated.current) return;
    hydrated.current = true;
    const ids = draft.items.map((i) => i.catalogueItemId).filter(Boolean) as string[];
    (async () => {
      const r = ids.length ? await apiClient.get<{ items: CatalogueItem[] }>(`/investigations/catalogue?domain=${domain}&ids=${ids.join(",")}`) : { items: [] as CatalogueItem[] };
      const found = new Map(r.items.map((i) => [i.id, i]));
      setSelected(draft.items.map((d, n) => ({ key: d.catalogueItemId ?? `d${n}`, item: d.catalogueItemId ? found.get(d.catalogueItemId) : undefined, custom: d.custom, facilityId: d.preferredFacilityId, instructions: d.instructions, duplicateReason: d.duplicateOverrideReason })).filter((s) => s.item || s.custom));
    })().catch(() => toast.error("Could not restore the draft"));
  }, [draft, domain]);

  const selectedIds = useMemo(() => new Set(selected.filter((s) => s.item).map((s) => s.item!.id)), [selected]);
  const duplicates = patientId && selectedIds.size > 0 ? dupState : [];

  const add = (item: CatalogueItem) => {
    setSelected((cur) => {
      if (cur.some((s) => s.item?.id === item.id)) return cur;
      const facilityId = item.facilities.length === 1 ? item.facilities[0].facilityId : undefined;
      return [...cur, { key: item.id, item, facilityId }];
    });
  };
  const remove = (key: string) => setSelected((cur) => cur.filter((s) => s.key !== key));
  const toggle = (item: CatalogueItem) => (selectedIds.has(item.id) ? remove(item.id) : add(item));

  // ---- duplicate detection ----------------------------------------------
  useEffect(() => {
    const ids = [...selectedIds];
    if (!patientId || ids.length === 0) return;
    const t = setTimeout(() => {
      apiClient.post<{ duplicates: Duplicate[] }>("/investigations/orders/duplicates", { patientId, domain, catalogueItemIds: ids, excludeOrderId: draftId }).then((r) => setDuplicates(r.duplicates)).catch(() => setDuplicates([]));
    }, 300);
    return () => clearTimeout(t);
  }, [patientId, domain, selectedIds, draftId]);

  // ---- order sets & AI ----------------------------------------------------
  const applySet = (members: { id: string | null; name: string }[]) => {
    const ids = members.map((m) => m.id).filter(Boolean) as string[];
    apiClient.get<{ items: CatalogueItem[] }>(`/investigations/catalogue?domain=${domain}&ids=${ids.join(",")}`)
      .then((r) => { r.items.forEach(add); toast.success(`${r.items.length} investigation${r.items.length === 1 ? "" : "s"} added`); })
      .catch(() => toast.error("Could not add the order set"));
  };

  const saveAsSet = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return toast.error("Select investigations first");
    const name = window.prompt("Name this order set");
    if (!name?.trim()) return;
    try {
      await apiClient.post("/investigations/order-sets", { name: name.trim(), domain, catalogueItemIds: ids });
      toast.success("Order set saved");
      setSets(await apiClient.get<OrderSets>(`/investigations/order-sets?domain=${domain}`));
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not save the set"); }
  };

  const askAi = async () => {
    if (query.trim().length < 3) return toast.error("Describe what you are looking for first");
    setAiBusy(true);
    try {
      const r = await apiClient.post<{ matches: { id: string; name: string; reason: string }[]; source: string }>("/investigations/ai-assist", { mode: "suggest", domain, description: query.trim() });
      setAiMatches(r.matches);
      if (r.source === "search") toast.message("AI is unavailable - showing the closest catalogue matches");
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Suggestions unavailable"); } finally { setAiBusy(false); }
  };

  // ---- submit -------------------------------------------------------------
  const payload = () => ({
    domain, patientId, priority, clinicalIndication: indication || undefined, diagnosis: diagnosis || undefined, clinicalNotes: notes || undefined, referringDepartment: department || undefined,
    items: selected.map((s) => {
      const dupe = s.item ? duplicates.find((d) => d.catalogueItemId === s.item!.id) : undefined;
      return { catalogueItemId: s.item?.id, custom: s.custom, preferredFacilityId: s.facilityId, instructions: s.instructions || undefined, duplicateOverrideReason: dupe ? s.duplicateReason : undefined };
    }),
  });

  const validate = (forSubmit: boolean) => {
    if (!patientId) return "Choose a patient";
    if (selected.length === 0) return "Select at least one investigation";
    if (!forSubmit) return null;
    if (!indication.trim() && selected.some((s) => s.item)) return "Enter the clinical indication";
    for (const s of selected) if (s.item && s.item.facilities.length > 1 && !s.facilityId) return `Choose a facility for ${s.item.name}`;
    for (const d of duplicates) { const s = selected.find((x) => x.item?.id === d.catalogueItemId); if (!s?.duplicateReason || s.duplicateReason.trim().length < 5) return `Give a reason for repeating ${d.name}`; }
    if (!authorised) return "Confirm your electronic authorisation";
    return null;
  };

  const save = async (submit: boolean) => {
    const problem = validate(submit);
    if (problem) return toast.error(problem);
    setBusy(submit ? "submit" : "draft");
    try {
      let id = draftId;
      if (id) await apiClient.patch(`/investigations/orders/${id}`, payload());
      else id = (await apiClient.post<{ id: string }>("/investigations/orders", payload())).id;
      setDraftId(id);
      if (!submit) { toast.success("Draft saved"); return; }
      const r = await apiClient.post<{ id: string; referralPending: number }>(`/investigations/orders/${id}/submit`, { authorise: true });
      toast.success(r.referralPending ? "Order sent - some items need a facility (see order details)" : "Order sent to the facility");
      router.push(`/doctor/lab-requests/orders/${r.id}`);
      router.refresh();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not save the order"); } finally { setBusy(null); }
  };

  // ---- grouping -----------------------------------------------------------
  const visibleCategories = useMemo(() => {
    if (!groups) return [{ title: domain === "LABORATORY" ? "Scientific disciplines" : "Departments", cats: categories }];
    return groups.map((g) => ({ title: g.title, cats: categories.filter((c) => g.keys.includes(c.key)) })).filter((g) => g.cats.length);
  }, [groups, categories, domain]);

  const itemsBySub = useMemo(() => {
    const m = new Map<string, CatalogueItem[]>();
    for (const i of items) m.set(i.subcategory ?? i.category.name, [...(m.get(i.subcategory ?? i.category.name) ?? []), i]);
    return [...m.entries()];
  }, [items]);

  const title = domain === "LABORATORY" ? "Laboratory Analysis" : "Diagnostics";
  const aiById = new Map((aiMatches ?? []).map((m) => [m.id, m.reason]));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        {/* Patient + search */}
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">{title} catalogue</CardTitle>
              <Badge variant="outline">{PRIORITY_LABEL[priority]} priority</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Search the investigation catalogue" value={query} onChange={(e) => { setQuery(e.target.value); setAiMatches(null); }} placeholder="Search for an investigation, test, scan or procedure..." className="h-11 pl-9 pr-28 text-base" />
              <Button type="button" size="sm" variant="secondary" className="absolute right-1.5 top-1/2 -translate-y-1/2" onClick={askAi} disabled={aiBusy}>
                {aiBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />} Suggest
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Search by name, common name, abbreviation, synonym, code, department or category. Suggestions are optional and you choose and authorise every order.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiMatches && (
              <Alert>
                <Sparkles aria-hidden />
                <AlertTitle>Suggested matches</AlertTitle>
                <AlertDescription>
                  {aiMatches.length === 0 ? "No close matches found." : (
                    <ul className="mt-1 space-y-1">
                      {aiMatches.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2">
                          <span><span className="font-medium text-foreground">{m.name}</span> - {m.reason}</span>
                          <Button type="button" size="xs" variant="outline" onClick={() => { setQuery(m.name); setAiMatches(null); }}>Find</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              {([["browse", "Browse", null], ["frequent", "Frequently ordered", Star], ["recent", "Recently ordered", Clock]] as const).map(([m, label, Icon]) => (
                <Button key={m} type="button" size="sm" variant={mode === m && !debounced ? "default" : "outline"} onClick={() => { setMode(m); setQuery(""); setLetter(null); }}>{Icon && <Icon className="size-3.5" aria-hidden />}{label}</Button>
              ))}
              {sets && (sets.sets.length > 0 || sets.templates.length > 0) && (
                <Collapsible className="w-full">
                  <CollapsibleTrigger className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><ChevronRight className="size-3.5" aria-hidden />Order sets and common panels</CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {sets.sets.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg border p-2">
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{s.name}</p><p className="truncate text-xs text-muted-foreground">{s.members.map((m) => m.name).join(", ")}</p></div>
                        <Button type="button" size="xs" variant="outline" onClick={() => applySet(s.members)}>Add</Button>
                      </div>
                    ))}
                    {sets.templates.map((t) => (
                      <div key={t.name} className="flex items-center justify-between rounded-lg border border-dashed p-2">
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{t.name}</p><p className="truncate text-xs text-muted-foreground">Starter template - {t.members.map((m) => m.name).join(", ")}</p></div>
                        <Button type="button" size="xs" variant="outline" onClick={() => applySet(t.members)}>Add</Button>
                      </div>
                    ))}
                    <p className="col-span-full text-xs text-muted-foreground">Order sets are configurable examples, not clinical recommendations.</p>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            {mode === "browse" && !debounced && (
              <div className="flex flex-wrap gap-0.5" aria-label="Alphabetical browse">
                <Button type="button" size="xs" variant={letter === null && !categoryId ? "secondary" : "ghost"} onClick={() => { setLetter(null); setCategoryId(null); }}>All</Button>
                {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => (
                  <Button key={l} type="button" size="xs" variant={letter === l ? "secondary" : "ghost"} className="w-7 px-0" onClick={() => { setLetter(letter === l ? null : l); setCategoryId(null); }}>{l}</Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-[230px_minmax(0,1fr)]">
          {/* Category navigation */}
          <nav aria-label="Categories" className="space-y-3 md:max-h-[70vh] md:overflow-y-auto md:pr-1">
            {visibleCategories.map((g) => (
              <div key={g.title}>
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
                {g.cats.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setCategoryId(categoryId === c.id ? null : c.id); setMode("browse"); setQuery(""); setLetter(null); }} className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-muted ${categoryId === c.id ? "bg-primary/10 font-medium text-primary" : ""}`}>
                    <span className="truncate">{c.name}</span><span className="ml-2 text-xs text-muted-foreground">{c.itemCount}</span>
                  </button>
                ))}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-full justify-start" onClick={() => setCustomOpen(true)}><Plus className="size-3.5" aria-hidden />{UNLISTED_LABEL[domain]}</Button>
          </nav>

          {/* Results */}
          <div className="min-w-0 space-y-3">
            {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Searching...</div>}
            {!loading && items.length === 0 && (
              <Card><CardContent className="space-y-2 py-8 text-center text-sm text-muted-foreground">
                <p>{mode !== "browse" ? "Nothing here yet. Investigations you order often will appear here." : "No matching investigation in the catalogue."}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setCustomOpen(true)}><Plus className="size-3.5" aria-hidden />Request it as a custom investigation</Button>
              </CardContent></Card>
            )}
            {itemsBySub.map(([sub, list]) => (
              <section key={sub} aria-label={sub}>
                <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sub}</h3>
                <ul className="divide-y rounded-xl border bg-card">
                  {list.map((i) => {
                    const on = selectedIds.has(i.id);
                    return (
                      <li key={i.id}>
                        <label className={`flex cursor-pointer items-start gap-3 p-3 transition hover:bg-muted/50 ${on ? "bg-primary/5" : ""}`}>
                          <Checkbox checked={on} onChange={() => toggle(i)} className="mt-1" aria-label={`Select ${i.name}`} />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium">{i.name}</span>
                              {i.abbreviation && <Badge variant="secondary">{i.abbreviation}</Badge>}
                              {i.isPanel && <Badge variant="outline">Panel</Badge>}
                              {aiById.has(i.id) && <Badge variant="teal"><Sparkles aria-hidden />Suggested</Badge>}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {[i.category.name, i.specimenType ?? i.modality, i.turnaroundMinutes ? `~${i.turnaroundMinutes >= 1440 ? `${Math.round(i.turnaroundMinutes / 1440)} d` : `${Math.round(i.turnaroundMinutes / 60)} h`}` : null].filter(Boolean).join(" · ")}
                              {i.loincCode && <> · LOINC {i.loincCode}{!i.standardCodesVerified && " (unverified)"}</>}
                              {i.dicomModality && <> · DICOM {i.dicomModality}</>}
                            </span>
                            <span className="mt-0.5 block text-xs">
                              {i.facilities.length === 0 ? <span className="text-warning">No participating facility yet - will go to referral</span> : <span className="text-muted-foreground">{i.facilities.length} facilit{i.facilities.length === 1 ? "y" : "ies"} available</span>}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>

      {/* Order panel */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Patient</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="patient" className="sr-only">Patient</Label>
              <select id="patient" className={fieldClass} value={patientId} onChange={(e) => setPatientId(e.target.value)} disabled={!!draft}>
                <option value="">Select a patient...</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name} - {p.caseNumber}</option>)}
              </select>
            </div>
            {patient && (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Patient ID</dt><dd className="font-medium">{patient.caseNumber}</dd>
                <dt className="text-muted-foreground">Date of birth</dt><dd>{patient.dateOfBirth} ({patient.age} y)</dd>
                <dt className="text-muted-foreground">Sex</dt><dd className="capitalize">{patient.sex.toLowerCase()}</dd>
                <dt className="text-muted-foreground">Encounter</dt><dd>{patient.encounter ?? "-"}</dd>
                <dt className="text-muted-foreground">Treating doctor</dt><dd>{doctorName}</dd>
                <dt className="text-muted-foreground">Allergies</dt>
                <dd>{patient.allergies.length ? patient.allergies.map((a) => <Badge key={a} variant="warning" className="mr-1">{a}</Badge>) : "None recorded"}</dd>
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Selected investigations ({selected.length})</CardTitle>
              <Button type="button" size="xs" variant="ghost" onClick={saveAsSet} disabled={selectedIds.size === 0}><BookmarkPlus className="size-3.5" aria-hidden />Save as set</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {selected.length === 0 && <p className="text-sm text-muted-foreground">Tick investigations in the catalogue to add them to this order.</p>}
            {selected.map((s) => {
              const name = s.item?.name ?? s.custom!.name;
              const dupe = s.item ? duplicates.find((d) => d.catalogueItemId === s.item!.id) : undefined;
              return (
                <div key={s.key} className="space-y-1.5 rounded-lg border p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="text-sm font-medium leading-tight">{name}</p>{s.custom && <Badge variant="outline" className="mt-1">Custom request</Badge>}</div>
                    <Button type="button" size="icon-xs" variant="ghost" onClick={() => remove(s.key)} aria-label={`Remove ${name}`}><X className="size-3.5" aria-hidden /></Button>
                  </div>
                  {s.item && s.item.facilities.length > 0 && (
                    <select aria-label={`Facility for ${name}`} className={fieldClass} value={s.facilityId ?? ""} onChange={(e) => setSelected((cur) => cur.map((x) => (x.key === s.key ? { ...x, facilityId: e.target.value || undefined } : x)))}>
                      {s.item.facilities.length > 1 && <option value="">Choose a facility...</option>}
                      {s.item.facilities.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}{f.city ? `, ${f.city}` : ""}{f.priceMinor != null ? ` - ₦${(f.priceMinor / 100).toLocaleString()}` : ""}</option>)}
                    </select>
                  )}
                  {s.item && s.item.facilities.length === 0 && <p className="text-xs text-warning">No facility offers this yet; it will wait for a referral.</p>}
                  {dupe && (
                    <Alert variant="warning">
                      <AlertTriangle aria-hidden />
                      <AlertTitle>Possible duplicate</AlertTitle>
                      <AlertDescription>
                        {dupe.reason === "COVERED_BY_PANEL" ? `Covered by ${dupe.matchedName}` : "Already requested"} on order {dupe.matchedOrderNumber} ({new Date(dupe.requestedAt).toLocaleDateString()}).
                        <Input className="mt-1.5" placeholder="Reason for repeating (required)" value={s.duplicateReason ?? ""} onChange={(e) => setSelected((cur) => cur.map((x) => (x.key === s.key ? { ...x, duplicateReason: e.target.value } : x)))} />
                      </AlertDescription>
                    </Alert>
                  )}
                  {s.item?.preparation && <p className="text-xs text-muted-foreground">Preparation: {s.item.preparation}</p>}
                  <Input aria-label={`Instructions for ${name}`} placeholder="Specific instructions (optional)" value={s.instructions ?? ""} onChange={(e) => setSelected((cur) => cur.map((x) => (x.key === s.key ? { ...x, instructions: e.target.value } : x)))} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Request details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Priority">
              {(["ROUTINE", "URGENT", "EMERGENCY"] as const).map((p) => (
                <Button key={p} type="button" size="sm" role="radio" aria-checked={priority === p} variant={priority === p ? (p === "EMERGENCY" ? "destructive" : "default") : "outline"} onClick={() => setPriority(p)}>{PRIORITY_LABEL[p]}</Button>
              ))}
            </div>
            <div className="space-y-1"><Label htmlFor="indication">Clinical indication *</Label><Textarea id="indication" rows={2} value={indication} onChange={(e) => setIndication(e.target.value)} placeholder="Why is this investigation needed?" /></div>
            <div className="space-y-1"><Label htmlFor="diagnosis">Relevant diagnosis</Label><Input id="diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="notes">Clinical notes</Label><Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="dept">Referring department</Label><Input id="dept" value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
            <label className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5 text-xs">
              <Checkbox checked={authorised} onChange={(e) => setAuthorised(e.target.checked)} className="mt-0.5" />
              <span><ShieldCheck className="mr-1 inline size-3.5 text-primary" aria-hidden />{ELECTRONIC_AUTHORISATION_STATEMENT}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => save(false)}>{busy === "draft" && <Loader2 className="animate-spin" aria-hidden />}Save draft</Button>
              <Button type="button" disabled={busy !== null} onClick={() => save(true)}>{busy === "submit" && <Loader2 className="animate-spin" aria-hidden />}Submit order</Button>
            </div>
          </CardContent>
        </Card>
      </aside>

      <CustomDialog domain={domain} open={customOpen} onOpenChange={setCustomOpen} categories={categories} onAdd={(c) => { setSelected((cur) => [...cur, { key: `c${Date.now()}`, custom: c }]); setCustomOpen(false); }} />
    </div>
  );
}

function CustomDialog({ domain, open, onOpenChange, categories, onAdd }: { domain: "LABORATORY" | "DIAGNOSTIC"; open: boolean; onOpenChange: (v: boolean) => void; categories: Category[]; onAdd: (c: CustomDetails) => void }) {
  const [v, setV] = useState<CustomDetails>({ name: "" });
  const set = (k: keyof CustomDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((cur) => ({ ...cur, [k]: e.target.value }));
  const lab = domain === "LABORATORY";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{UNLISTED_LABEL[domain]}</DialogTitle>
          <DialogDescription>Request an investigation that is not in the catalogue. The facility will accept it, or you can refer it to another facility.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="c-name">{lab ? "Investigation name" : "Name of diagnostic procedure"} *</Label><Input id="c-name" value={v.name} onChange={set("name")} /></div>
          {lab ? (
            <>
              <div className="space-y-1"><Label htmlFor="c-disc">Scientific discipline</Label><Input id="c-disc" value={v.discipline ?? ""} onChange={set("discipline")} /></div>
              <div className="space-y-1"><Label htmlFor="c-spec">Specimen type</Label><Input id="c-spec" value={v.specimenType ?? ""} onChange={set("specimenType")} /></div>
            </>
          ) : (
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="c-body">Body part or anatomical region</Label><Input id="c-body" value={v.bodySite ?? ""} onChange={set("bodySite")} /></div>
          )}
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="c-ind">Clinical indication</Label><Textarea id="c-ind" rows={2} value={v.clinicalIndication ?? ""} onChange={set("clinicalIndication")} /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="c-hist">Relevant clinical history</Label><Textarea id="c-hist" rows={2} value={v.relevantHistory ?? ""} onChange={set("relevantHistory")} /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="c-req">Specific {lab ? "test requirements" : "instructions"}</Label><Textarea id="c-req" rows={2} value={v.requirements ?? ""} onChange={set("requirements")} /></div>
          <div className="space-y-1"><Label htmlFor="c-dept">Requested {lab ? "laboratory" : "diagnostic"} department</Label>
            <select id="c-dept" className={fieldClass} value={v.requestedDepartment ?? ""} onChange={set("requestedDepartment")}><option value="">Other / not sure</option>{categories.filter((c) => !c.key.startsWith("other-")).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor="c-com">Additional comments</Label><Input id="c-com" value={v.comments ?? ""} onChange={set("comments")} /></div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={v.name.trim().length < 2} onClick={() => { onAdd({ ...v, name: v.name.trim() }); setV({ name: "" }); }}>Add to order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
