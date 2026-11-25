"use client";

import { useCallback, useEffect, useState } from "react";

interface Metric { key: string; name: string; unit: string; betterWhen: string; targetable: boolean; description: string }
interface Target { id: string; metricKey: string; departmentId: string | null; targetValue: number; direction: string; note: string | null }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Request failed");
  return json as T;
}

export function TargetsEditor({ canManage }: { canManage: boolean }) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [metricKey, setMetricKey] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, t] = await Promise.all([api<{ metrics: Metric[] }>("/api/facility/analytics/metrics"), api<{ targets: Target[] }>("/api/facility/analytics/targets")]);
      const targetable = m.metrics.filter((x) => x.targetable);
      setMetrics(targetable); setTargets(t.targets); setMetricKey((k) => k || targetable[0]?.key || "");
    } catch (e) { setError((e as Error).message); }
  }, []);
  // Initial load of server data.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const selected = metrics.find((m) => m.key === metricKey);
  const save = async () => { setError(null); try { await api("/api/facility/analytics/targets", { method: "PUT", body: JSON.stringify({ metricKey, targetValue: Number(value), note: note || null }) }); setValue(""); setNote(""); await load(); } catch (e) { setError((e as Error).message); } };
  const remove = async (t: Target) => { try { await api(`/api/facility/analytics/targets?metricKey=${t.metricKey}${t.departmentId ? `&departmentId=${t.departmentId}` : ""}`, { method: "DELETE" }); await load(); } catch (e) { setError((e as Error).message); } };
  const name = (k: string) => metrics.find((m) => m.key === k)?.name ?? k;
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Performance targets</h1><p className="text-sm text-muted-foreground">Set the targets your facility holds itself to. Dashboards show actual performance against them. Targets are yours: Medic1905 does not impose benchmarks.</p></div>
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {canManage ? (
        <section className="rounded-xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground sm:col-span-2">Metric<select className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>{metrics.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}</select></label>
            <label className="text-xs text-muted-foreground">Target ({selected?.betterWhen === "LOWER" ? "at most" : "at least"}, {selected?.unit})<input type="number" step="any" min="0" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" /></label>
            <label className="text-xs text-muted-foreground sm:col-span-3">Note (optional)<input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" /></label>
          </div>
          {selected && <p className="mt-2 text-xs text-muted-foreground">{selected.description}</p>}
          <button disabled={!value || Number.isNaN(Number(value))} onClick={save} className="mt-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">Save target</button>
        </section>
      ) : <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">You can view targets. Changing them needs the manage-settings permission.</p>}
      <section className="rounded-xl border bg-card p-4">
        {targets.length === 0 ? <p className="text-sm text-muted-foreground">No targets set yet.</p> : <ul className="divide-y text-sm">{targets.map((t) => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><strong>{name(t.metricKey)}</strong> {t.direction === "AT_LEAST" ? "≥" : "≤"} {t.targetValue}{t.departmentId ? " (department)" : ""}{t.note ? <span className="text-muted-foreground"> — {t.note}</span> : null}</span>{canManage && <button onClick={() => remove(t)} className="text-xs text-red-600 hover:underline">Remove</button>}</li>)}</ul>}
      </section>
    </div>
  );
}
