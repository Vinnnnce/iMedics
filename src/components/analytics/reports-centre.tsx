"use client";

import { useCallback, useEffect, useState } from "react";

interface Catalogue { category: string; reports: { key: string; description: string }[] }
interface Recent { id: string; reportKey: string; title: string; periodStart: string; periodEnd: string; rowCount: number; trigger: string; createdAt: string }
interface Definition { id: string; name: string; reportKey: string; schedule: string; nextRunAt: string | null; active: boolean }

const PRESETS: [string, string][] = [["LAST_WEEK", "Last week"], ["LAST_MONTH", "Last month"], ["LAST_QUARTER", "Last quarter"], ["LAST_YEAR", "Last year"], ["THIS_MONTH", "This month so far"], ["THIS_QUARTER", "This quarter so far"], ["THIS_YEAR", "This year so far"], ["CUSTOM", "Custom range"]];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "Request failed");
  return json as T;
}

export function ReportsCentre() {
  const [catalogue, setCatalogue] = useState<Catalogue[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [defs, setDefs] = useState<Definition[]>([]);
  const [reportKey, setReportKey] = useState("");
  const [preset, setPreset] = useState("LAST_MONTH");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [name, setName] = useState(""); const [schedule, setSchedule] = useState("NONE");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, d] = await Promise.all([api<{ catalogue: Catalogue[]; recent: Recent[] }>("/api/facility/analytics/reports"), api<{ definitions: Definition[] }>("/api/facility/analytics/definitions")]);
      setCatalogue(r.catalogue); setRecent(r.recent); setDefs(d.definitions);
      setReportKey((k) => k || r.catalogue[0]?.reports[0]?.key || "");
    } catch (e) { setError((e as Error).message); }
  }, []);
  // Initial load of server data.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(null); setMessage(null); try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const generate = () => run(async () => { await api("/api/facility/analytics/reports", { method: "POST", body: JSON.stringify({ reportKey, preset, from: from || undefined, to: to || undefined }) }); setMessage("Report generated."); });
  const save = () => run(async () => { await api("/api/facility/analytics/definitions", { method: "POST", body: JSON.stringify({ name, reportKey, schedule }) }); setName(""); setMessage(schedule === "NONE" ? "Template saved." : "Template saved and scheduled."); });
  const remove = (id: string) => run(async () => { await api(`/api/facility/analytics/definitions?id=${id}`, { method: "DELETE" }); });
  const label = (k: string) => catalogue.flatMap((c) => c.reports).find((r) => r.key === k)?.key.replace("-", " ") ?? k;

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">Management reports</h1><p className="text-sm text-muted-foreground">Every report states its period, data scope, comparison basis and calculation definitions. Exports are recorded in the audit trail.</p></div>
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {message && <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{message}</div>}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Generate a report</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-muted-foreground">Report<select className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" value={reportKey} onChange={(e) => setReportKey(e.target.value)}>{catalogue.map((c) => <optgroup key={c.category} label={c.category}>{c.reports.map((r) => <option key={r.key} value={r.key}>{r.key.replace("-", " ")} — {r.description}</option>)}</optgroup>)}</select></label>
          <label className="text-xs text-muted-foreground">Period<select className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" value={preset} onChange={(e) => setPreset(e.target.value)}>{PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {preset === "CUSTOM" && <><label className="text-xs text-muted-foreground">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" /></label><label className="text-xs text-muted-foreground">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" /></label></>}
        </div>
        <button disabled={busy || !reportKey} onClick={generate} className="mt-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">Generate</button>
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Saved templates and scheduled reports</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">Template name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" placeholder="Monthly hospital summary" /></label>
          <label className="text-xs text-muted-foreground">Generate automatically<select value={schedule} onChange={(e) => setSchedule(e.target.value)} className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground">{[["NONE", "Not scheduled"], ["WEEKLY", "Every week"], ["MONTHLY", "Every month"], ["QUARTERLY", "Every quarter"], ["ANNUAL", "Every year"]].map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <div className="flex items-end"><button disabled={busy || name.trim().length < 2 || !reportKey} onClick={save} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">Save template ({label(reportKey)})</button></div>
        </div>
        {defs.length > 0 && <ul className="mt-3 divide-y text-sm">{defs.map((d) => <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><strong>{d.name}</strong> · {d.reportKey.replace("-", " ")} · {d.schedule === "NONE" ? "manual" : d.schedule.toLowerCase()}{d.schedule !== "NONE" && (d.active ? (d.nextRunAt ? ` · next ${new Date(d.nextRunAt).toLocaleDateString()}` : "") : " · paused (creator no longer has access)")}</span><button onClick={() => remove(d.id)} className="text-xs text-red-600 hover:underline">Remove</button></li>)}</ul>}
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Generated reports</h2>
        {recent.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No reports generated yet.</p> : (
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-max text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-1.5 pr-3">Report</th><th className="pr-3">Period</th><th className="pr-3">Rows</th><th className="pr-3">Source</th><th className="pr-3">Generated</th><th>Download</th></tr></thead>
            <tbody>{recent.map((r) => <tr key={r.id} className="border-b last:border-0"><td className="py-1.5 pr-3">{r.title}</td><td className="pr-3">{r.periodStart.slice(0, 10)} → {r.periodEnd.slice(0, 10)}</td><td className="pr-3 tabular-nums">{r.rowCount}</td><td className="pr-3">{r.trigger.toLowerCase()}</td><td className="pr-3">{new Date(r.createdAt).toLocaleString()}</td><td className="space-x-2">{(["pdf", "xlsx", "csv"] as const).map((f) => <a key={f} className="text-blue-600 hover:underline" href={`/api/facility/analytics/reports/${r.id}?format=${f}`}>{f === "xlsx" ? "Excel" : f.toUpperCase()}</a>)}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
