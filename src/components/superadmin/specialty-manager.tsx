"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Stethoscope, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

type Specialty = { id: string; name: string; category: string; description: string; active: boolean };
type SpecData = { specialties: Specialty[]; facilityDepartments: { name: string; _count: { _all: number } }[] };

const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm";
const CATEGORIES = ["CLINICAL", "LABORATORY", "DIAGNOSTIC", "NURSING", "PHARMACY", "ADMINISTRATIVE"] as const;

export function SpecialtyManager() {
  const [data, setData] = useState<SpecData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await apiClient.get<SpecData>("/admin/specialties")); }
    catch (e) { setError(e instanceof Error ? e.message : "Specialty data unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void reload(); }); return () => { active = false; }; }, [reload]);

  const act = async (payload: Record<string, unknown>, message: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await apiClient.post("/admin/specialties", payload); setNotice(message); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  };

  const usage = (name: string) => data?.facilityDepartments.find((d) => d.name === name)?._count._all ?? 0;

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Stethoscope className="size-4" />Healthcare Network</p>
        <h1 className="text-xl font-bold">Departments & Specialties</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Configure the standard medical departments and specialties available across the platform. Facilities adopt these when configuring their own departments, permissions and templates.</p>
      </div>
      <Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 size-4" />Refresh</Button>
    </header>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}

    <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void act({ action: "CREATE", name: f.get("name"), category: f.get("category"), description: f.get("description") }, "Specialty added to the global catalogue."); e.currentTarget.reset(); }}>
      <Field label="New specialty"><input name="name" required minLength={2} maxLength={120} className={inputClass} placeholder="e.g. Nuclear Medicine" /></Field>
      <Field label="Category"><select name="category" required className={inputClass}>{CATEGORIES.map((c) => <option key={c} value={c}>{c.toLowerCase()}</option>)}</select></Field>
      <Field label="Description"><input name="description" maxLength={500} className={inputClass} /></Field>
      <Button type="submit" disabled={busy} className="self-end"><Plus className="mr-2 size-4" />Add</Button>
    </form>

    {loading && <div role="status" className="rounded-xl border p-8 text-sm text-muted-foreground">Loading the specialty catalogue…</div>}
    {data && CATEGORIES.map((cat) => {
      const items = data.specialties.filter((s) => s.category === cat);
      if (!items.length) return null;
      return <section key={cat} aria-label={cat.toLowerCase()} className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{cat.charAt(0) + cat.slice(1).toLowerCase()}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((s) => <article key={s.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border bg-card p-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{s.name}{!s.active && <Badge variant="secondary" className="ml-2">inactive</Badge>}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{usage(s.name)} facility department{usage(s.name) === 1 ? "" : "s"} use this name</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void act({ action: "UPDATE", id: s.id, active: !s.active }, s.active ? "Specialty deactivated." : "Specialty reactivated.")}>{s.active ? "Deactivate" : "Reactivate"}</Button>
              <Button variant="ghost" size="sm" aria-label={`Delete ${s.name}`} disabled={busy || usage(s.name) > 0} title={usage(s.name) > 0 ? "Facilities still use this specialty" : undefined} onClick={() => void act({ action: "DELETE", id: s.id }, "Specialty deleted.")}><Trash2 className="size-4" /></Button>
            </div>
          </article>)}
        </div>
      </section>;
    })}
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return <div className="grid min-w-0 gap-2 text-sm font-medium"><label htmlFor={id}>{label}</label>{children}</div>;
}
