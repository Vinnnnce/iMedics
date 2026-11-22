"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, ApiError } from "@/lib/api-client";
import { REPORT_FORMAT_LABEL } from "@/lib/investigations/constants";
import { fieldClass } from "../badges";

interface Offering { id: string; isActive: boolean; priceMinor: number | null; turnaroundMinutes: number | null; departmentKey: string | null; preparation: string | null; localAliases: string[] }
interface Row { id: string; domain: "LABORATORY" | "DIAGNOSTIC"; code: string; name: string; abbreviation: string | null; subcategory: string | null; loincCode: string | null; snomedCode: string | null; standardCodesVerified: boolean; source: "SYSTEM" | "FACILITY"; turnaroundMinutes: number | null; category: { id: string; key: string; name: string }; offering: Offering | null }
interface Cat { id: string; key: string; name: string; domain: "LABORATORY" | "DIAGNOSTIC" }

export function CatalogueManager({ domains }: { domains: ("LABORATORY" | "DIAGNOSTIC")[] }) {
  const [domain, setDomain] = useState<"LABORATORY" | "DIAGNOSTIC">(domains[0]);
  const [q, setQ] = useState("");
  const [onlyOffered, setOnlyOffered] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return apiClient.get<{ items: Row[]; categories: Cat[] }>(`/facility/investigations/catalogue?domain=${domain}&onlyOffered=${onlyOffered}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}&limit=200`)
      .then((r) => { setRows(r.items); setCats(r.categories); }).catch(() => toast.error("Could not load the catalogue")).finally(() => setLoading(false));
  }, [domain, q, onlyOffered]);
  useEffect(() => { const t = setTimeout(() => void load(), q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const toggle = async (r: Row, on: boolean) => {
    try {
      if (r.offering) await apiClient.patch(`/facility/investigations/catalogue/${r.id}`, { isActive: on });
      else await apiClient.post("/facility/investigations/catalogue", { catalogueItemId: r.id, isActive: on });
      await load();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not update"); }
  };
  const bulk = async (categoryId: string, enable: boolean) => {
    try { const r = await apiClient.post<{ count: number }>("/facility/investigations/catalogue/bulk", { categoryIds: [categoryId], enable }); toast.success(`${r.count} service${r.count === 1 ? "" : "s"} ${enable ? "enabled" : "disabled"}`); await load(); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not update"); }
  };

  const domainCats = cats.filter((c) => c.domain === domain && !c.key.startsWith("other-"));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Departments</CardTitle>
          <CardDescription>Switch on a whole department of the standard catalogue in one step, then fine-tune prices and turnaround per test. Doctors only see facilities that offer a service.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {domainCats.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm">{c.name}<Button size="xs" variant="ghost" onClick={() => bulk(c.id, true)}>Enable all</Button><Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => bulk(c.id, false)}>Disable</Button></span>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {domains.length > 1 && <select aria-label="Type" className={`${fieldClass} w-44`} value={domain} onChange={(e) => setDomain(e.target.value as typeof domain)}><option value="LABORATORY">Laboratory</option><option value="DIAGNOSTIC">Diagnostics</option></select>}
          <label className="flex items-center gap-2 text-sm"><Switch checked={onlyOffered} onCheckedChange={setOnlyOffered} aria-label="Only my services" />Only my services</label>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input aria-label="Search catalogue" className="pl-8" placeholder="Search services" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Button size="sm" onClick={() => setAdding(true)}><Plus aria-hidden />New investigation</Button>
        </div>
      </div>

      {loading ? <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Loading...</div> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Offered", "Investigation", "Department", "Price", "Turnaround", "Codes", ""].map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2"><Switch checked={!!r.offering?.isActive} onCheckedChange={(v) => toggle(r, v)} aria-label={`Offer ${r.name}`} /></td>
                  <td className="px-3 py-2"><p className="font-medium">{r.name}{r.source === "FACILITY" && <Badge variant="outline" className="ml-1.5">Yours</Badge>}</p><p className="text-xs text-muted-foreground">{r.subcategory}</p></td>
                  <td className="px-3 py-2 text-muted-foreground">{(r.offering?.departmentKey ?? r.category.key).replace(/-/g, " ")}</td>
                  <td className="px-3 py-2">{r.offering?.priceMinor != null ? `₦${(r.offering.priceMinor / 100).toLocaleString()}` : "-"}</td>
                  <td className="px-3 py-2">{(r.offering?.turnaroundMinutes ?? r.turnaroundMinutes) ? `${Math.round(((r.offering?.turnaroundMinutes ?? r.turnaroundMinutes) as number) / 60)} h` : "-"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.loincCode ? `LOINC ${r.loincCode}` : "-"}{r.snomedCode ? ` · SNOMED ${r.snomedCode}` : ""}{(r.loincCode || r.snomedCode) && !r.standardCodesVerified && <Badge variant="warning" className="ml-1">unverified</Badge>}</td>
                  <td className="px-3 py-2 text-right"><Button size="xs" variant="outline" onClick={() => setEdit(r)}>Configure</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <OfferingDialog row={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} cats={cats.filter((c) => c.domain === edit.domain)} />}
      {adding && <NewItemDialog domain={domain} cats={cats.filter((c) => c.domain === domain)} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void load(); }} />}
    </div>
  );
}

function OfferingDialog({ row, cats, onClose, onSaved }: { row: Row; cats: Cat[]; onClose: () => void; onSaved: () => void }) {
  const o = row.offering;
  const [price, setPrice] = useState(o?.priceMinor != null ? String(o.priceMinor / 100) : "");
  const [tat, setTat] = useState(o?.turnaroundMinutes != null ? String(Math.round(o.turnaroundMinutes / 60)) : "");
  const [dept, setDept] = useState(o?.departmentKey ?? "");
  const [prep, setPrep] = useState(o?.preparation ?? "");
  const [aliases, setAliases] = useState((o?.localAliases ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const body = { isActive: true, priceMinor: price.trim() ? Math.round(Number(price) * 100) : null, turnaroundMinutes: tat.trim() ? Math.round(Number(tat) * 60) : null, departmentKey: dept || null, preparation: prep.trim() || null, localAliases: aliases.split(",").map((a) => a.trim()).filter(Boolean) };
    try { if (o) await apiClient.patch(`/facility/investigations/catalogue/${row.id}`, body); else await apiClient.post("/facility/investigations/catalogue", { catalogueItemId: row.id, ...body }); toast.success("Saved"); onSaved(); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not save"); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{row.name}</DialogTitle><DialogDescription>How your facility offers this service.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="o-price">Price (₦)</Label><Input id="o-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="o-tat">Turnaround (hours)</Label><Input id="o-tat" inputMode="numeric" value={tat} onChange={(e) => setTat(e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="o-dept">Department / worklist</Label><select id="o-dept" className={fieldClass} value={dept} onChange={(e) => setDept(e.target.value)}><option value="">Default ({row.category.name})</option>{cats.map((c) => <option key={c.id} value={c.key}>{c.name}</option>)}</select></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="o-prep">Preparation instructions</Label><Textarea id="o-prep" rows={2} value={prep} onChange={(e) => setPrep(e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="o-alias">Local aliases (comma separated)</Label><Input id="o-alias" value={aliases} onChange={(e) => setAliases(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>{busy && <Loader2 className="animate-spin" aria-hidden />}Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewItemDialog({ domain, cats, onClose, onSaved }: { domain: "LABORATORY" | "DIAGNOSTIC"; cats: Cat[]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ name: "", abbreviation: "", synonyms: "", categoryId: cats[0]?.id ?? "", specimenType: "", modality: "", reportFormat: domain === "LABORATORY" ? "LAB_PANEL" : "GENERIC", loincCode: "", snomedCode: "", dicomModality: "", verified: false, price: "", tat: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((c) => ({ ...c, [k]: e.target.value }));
  const save = async () => {
    setBusy(true);
    try {
      await apiClient.post("/facility/investigations/catalogue", {
        newItem: { domain, categoryId: v.categoryId, name: v.name, abbreviation: v.abbreviation || undefined, synonyms: v.synonyms.split(",").map((s) => s.trim()).filter(Boolean), specimenType: v.specimenType || undefined, modality: v.modality || undefined, reportFormat: v.reportFormat, loincCode: v.loincCode || undefined, snomedCode: v.snomedCode || undefined, dicomModality: v.dicomModality || undefined, standardCodesVerified: v.verified },
        priceMinor: v.price.trim() ? Math.round(Number(v.price) * 100) : undefined, turnaroundMinutes: v.tat.trim() ? Math.round(Number(v.tat) * 60) : undefined,
      });
      toast.success("Investigation added to your catalogue"); onSaved();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not create"); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>New {domain === "LABORATORY" ? "laboratory investigation" : "diagnostic procedure"}</DialogTitle><DialogDescription>Added to your facility and searchable by doctors. Leave standard codes empty unless you have verified them; a local code is assigned automatically.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="n-name">Name *</Label><Input id="n-name" value={v.name} onChange={set("name")} /></div>
          <div className="space-y-1"><Label htmlFor="n-cat">Department *</Label><select id="n-cat" className={fieldClass} value={v.categoryId} onChange={set("categoryId")}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor="n-fmt">Report format</Label><select id="n-fmt" className={fieldClass} value={v.reportFormat} onChange={set("reportFormat")}>{Object.entries(REPORT_FORMAT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div className="space-y-1"><Label htmlFor="n-abbr">Abbreviation</Label><Input id="n-abbr" value={v.abbreviation} onChange={set("abbreviation")} /></div>
          <div className="space-y-1"><Label htmlFor="n-syn">Synonyms (comma separated)</Label><Input id="n-syn" value={v.synonyms} onChange={set("synonyms")} /></div>
          <div className="space-y-1"><Label htmlFor="n-spec">{domain === "LABORATORY" ? "Specimen type" : "Modality"}</Label><Input id="n-spec" value={domain === "LABORATORY" ? v.specimenType : v.modality} onChange={set(domain === "LABORATORY" ? "specimenType" : "modality")} /></div>
          <div className="space-y-1"><Label htmlFor="n-dicom">DICOM modality code</Label><Input id="n-dicom" value={v.dicomModality} onChange={set("dicomModality")} placeholder="optional" /></div>
          <div className="space-y-1"><Label htmlFor="n-loinc">LOINC code</Label><Input id="n-loinc" value={v.loincCode} onChange={set("loincCode")} placeholder="e.g. 718-7" /></div>
          <div className="space-y-1"><Label htmlFor="n-snomed">SNOMED CT concept id</Label><Input id="n-snomed" value={v.snomedCode} onChange={set("snomedCode")} /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="accent-primary" checked={v.verified} onChange={(e) => setV((c) => ({ ...c, verified: e.target.checked }))} />I have verified these codes against the licensed terminology release</label>
          <div className="space-y-1"><Label htmlFor="n-price">Price (₦)</Label><Input id="n-price" inputMode="decimal" value={v.price} onChange={set("price")} /></div>
          <div className="space-y-1"><Label htmlFor="n-tat">Turnaround (hours)</Label><Input id="n-tat" inputMode="numeric" value={v.tat} onChange={set("tat")} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || v.name.trim().length < 2 || !v.categoryId} onClick={save}>{busy && <Loader2 className="animate-spin" aria-hidden />}Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
