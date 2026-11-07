"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Settings, Plus, RefreshCw, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

type Setting = { key: string; value: unknown; description: string; updatedAt: string; updatedBy: { name: string } | null };
type SettingsData = { settings: Setting[]; protectedKeys: string[] };

const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm";

export function SettingsEditor() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await apiClient.get<SettingsData>("/admin/settings")); }
    catch (e) { setError(e instanceof Error ? e.message : "Settings unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void reload(); }); return () => { active = false; }; }, [reload]);

  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Settings className="size-4" />Master Governance</p>
        <h1 className="text-xl font-bold">Platform Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Global platform settings: identity, defaults, retention and limits. Every change is recorded in the tamper-evident audit trail with before and after values.</p>
      </div>
      <Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 size-4" />Refresh</Button>
    </header>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}

    <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={async (e) => {
      e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError(""); setNotice("");
      let value: unknown = f.get("value");
      try { value = JSON.parse(String(value)); } catch { /* keep as string */ }
      try {
        await apiClient.post("/admin/settings", { key: String(f.get("key") ?? "").toLowerCase(), value, description: String(f.get("description") ?? "") });
        setNotice("Setting saved."); await reload(); e.currentTarget.reset();
      } catch (err) { setError(err instanceof Error ? err.message : "Could not save the setting"); }
      finally { setBusy(false); }
    }}>
      <Field label="Key (e.g. branding.platformName)"><input name="key" required pattern="[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){1,4}" className={inputClass} /></Field>
      <Field label="Value (JSON or plain text)"><input name="value" required className={inputClass} placeholder='"Medic1905" / 30 / true' /></Field>
      <Field label="Description"><input name="description" maxLength={300} className={inputClass} /></Field>
      <Button type="submit" disabled={busy} className="self-end"><Plus className="mr-2 size-4" />Save setting</Button>
    </form>

    <p className="flex items-start gap-2 rounded-xl border bg-card p-4 text-sm text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0" />Keys under security., privacy., backup. and release. are protected — only the Super Admin can change them, and they never replace the enforced database policies.</p>

    {loading && <div role="status" className="rounded-xl border p-8 text-sm text-muted-foreground">Loading platform settings…</div>}
    {data && <section aria-label="Current settings" className="space-y-2">
      {data.settings.map((s) => <article key={s.key} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4 text-sm">
        <div className="min-w-0">
          <p className="break-all font-mono text-xs font-semibold">{s.key}{data.protectedKeys.includes(s.key) && <Badge variant="outline" className="ml-2">protected</Badge>}</p>
          <p className="mt-1 break-all font-mono text-sm">{JSON.stringify(s.value)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{s.description || "No description"} · updated by {s.updatedBy?.name ?? "unknown"} · {new Date(s.updatedAt).toLocaleString()}</p>
        </div>
      </article>)}
      {!data.settings.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No platform settings recorded yet.</p>}
    </section>}
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return <div className="grid min-w-0 gap-2 text-sm font-medium"><label htmlFor={id}>{label}</label>{children}</div>;
}
