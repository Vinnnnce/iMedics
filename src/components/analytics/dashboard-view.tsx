"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DashboardPayload, KpiValue, Section } from "@/lib/analytics/types";
import { BarList, BedMap, CalendarHeat, DataTable, Donut, Empty, Funnel, fmt, Heatmap, LineChart, Progress, Sparkline, Stacked } from "./charts";

const PRESETS: [string, string][] = [["TODAY", "Today"], ["YESTERDAY", "Yesterday"], ["THIS_WEEK", "This week"], ["LAST_WEEK", "Last week"], ["THIS_MONTH", "This month"], ["LAST_MONTH", "Last month"], ["THIS_QUARTER", "This quarter"], ["LAST_QUARTER", "Last quarter"], ["THIS_YEAR", "This year"], ["LAST_YEAR", "Last year"], ["THIS_FINANCIAL_YEAR", "This financial year"], ["LAST_FINANCIAL_YEAR", "Last financial year"], ["CUSTOM", "Custom range"]];
const COMPARES: [string, string][] = [["PREVIOUS_PERIOD", "Previous equivalent period"], ["YEAR_OVER_YEAR", "Same period last year"], ["MONTH_OVER_MONTH", "Month over month"], ["WEEK_OVER_WEEK", "Week over week"], ["QUARTER_OVER_QUARTER", "Quarter over quarter"], ["CUSTOM", "Custom baseline"], ["NONE", "No comparison"]];
const RANGE_KEYS = ["preset", "from", "to", "compare", "compareFrom", "compareTo", "facilityId"];
const LIVE = new Set(["command-centre"]);

export function rangeQuery(sp: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const k of RANGE_KEYS) { const v = sp.get(k); if (v) out.set(k, v); }
  return out.toString();
}

function PeriodBar({ payload }: { payload: DashboardPayload | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    router.replace(`${pathname}?${next.toString()}`);
  };
  const preset = sp.get("preset") ?? "THIS_MONTH";
  const compare = sp.get("compare") ?? "PREVIOUS_PERIOD";
  const controls = (
    <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
      <label className="text-xs text-muted-foreground">Period
        <select className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" value={preset} onChange={(e) => set({ preset: e.target.value })}>{PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      {preset === "CUSTOM" && <>
        <label className="text-xs text-muted-foreground">From<input type="date" className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" value={sp.get("from") ?? ""} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="text-xs text-muted-foreground">To<input type="date" className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" value={sp.get("to") ?? ""} onChange={(e) => set({ to: e.target.value })} /></label>
      </>}
      <label className="text-xs text-muted-foreground">Compare with
        <select className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" value={compare} onChange={(e) => set({ compare: e.target.value })}>{COMPARES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      {compare === "CUSTOM" && <>
        <label className="text-xs text-muted-foreground">Baseline from<input type="date" className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" value={sp.get("compareFrom") ?? ""} onChange={(e) => set({ compareFrom: e.target.value })} /></label>
        <label className="text-xs text-muted-foreground">Baseline to<input type="date" className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground" value={sp.get("compareTo") ?? ""} onChange={(e) => set({ compareTo: e.target.value })} /></label>
      </>}
    </div>
  );
  return (
    <div className="rounded-xl border bg-card p-3 print:hidden">
      <details className="lg:hidden"><summary className="cursor-pointer text-sm font-medium">Filters · {payload?.range.current.label ?? "…"}</summary><div className="mt-3">{controls}</div></details>
      <div className="hidden lg:block">{controls}</div>
      {payload && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing <strong className="text-foreground">{payload.range.current.label}</strong> ({payload.range.current.startDate} to {payload.range.current.endDate}, {payload.range.timeZone})
          {payload.range.previous ? <> compared with <strong className="text-foreground">{payload.range.previous.label}</strong> ({payload.range.previous.startDate} to {payload.range.previous.endDate}){payload.range.likeForLike ? " — same number of elapsed days, because the current period is still in progress" : ""}</> : " — no comparison"}.
        </p>
      )}
    </div>
  );
}

function ChangeBadge({ k }: { k: KpiValue }) {
  const c = k.change;
  if (!c || c.direction === "UNKNOWN") return c ? <span className="text-xs text-muted-foreground">no comparison available</span> : null;
  const good = k.betterWhen === "NEUTRAL" ? null : (c.direction === "UP") === (k.betterWhen === "HIGHER");
  const tone = c.direction === "FLAT" || good === null ? "text-muted-foreground" : good ? "text-emerald-600" : "text-red-600";
  const arrow = c.direction === "UP" ? "▲" : c.direction === "DOWN" ? "▼" : "■";
  return (
    <span className={`text-xs ${tone}`} title={`Previous period: ${fmt(c.previous, k.unit)}`}>
      {arrow} {c.delta !== null ? `${c.delta > 0 ? "+" : ""}${fmt(c.delta, k.unit)}` : ""}{c.percent !== null ? ` (${c.percent > 0 ? "+" : ""}${c.percent}%)` : ""} <span className="text-muted-foreground">vs {fmt(c.previous, k.unit)}</span>
    </span>
  );
}

const TARGET_TONE: Record<string, string> = { MET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", NEAR: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", MISSED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", NO_DATA: "bg-muted text-muted-foreground" };

function KpiCard({ k, drillHref }: { k: KpiValue; drillHref: (key: string) => string }) {
  const small = k.sampleSize !== undefined && k.sampleSize > 0 && k.sampleSize < 20 && ["percent", "minutes", "hours", "days"].includes(k.unit);
  const body = (
    <div className="h-full rounded-xl border bg-card p-3 transition hover:border-blue-500/50">
      <div className="flex items-start justify-between gap-2"><span className="text-xs font-medium text-muted-foreground">{k.label}</span>{k.spark && <Sparkline values={k.spark} className="text-blue-600" />}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{k.value === null ? <span className="text-base font-normal text-muted-foreground">no data</span> : <>{k.currency ? <span className="mr-1 text-sm font-normal text-muted-foreground">{k.currency}</span> : null}{k.unit === "currency" ? Number(k.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : fmt(k.value, k.unit)}</>}</div>
      {k.numerator !== undefined && k.denominator !== undefined && <div className="text-xs text-muted-foreground tabular-nums">{k.numerator} of {k.denominator}</div>}
      <div className="mt-1"><ChangeBadge k={k} /></div>
      {k.target && <div className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${TARGET_TONE[k.target.status]}`}>Target {k.target.direction === "AT_LEAST" ? "≥" : "≤"} {fmt(k.target.value, k.unit)} · {k.target.status === "MET" ? "met" : k.target.status === "NEAR" ? "close" : k.target.status === "MISSED" ? "missed" : "no data"}</div>}
      {small && <div className="mt-1 text-xs text-amber-600">Small sample ({k.sampleSize}) — interpret with care.</div>}
      {k.note && <div className="mt-1 text-xs text-muted-foreground">{k.note}</div>}
    </div>
  );
  return k.drill ? <Link href={drillHref(k.drill)} className="block" aria-label={`${k.label}: open records`}>{body}</Link> : body;
}

function Visual({ section, drillHref }: { section: Section; drillHref: (key: string) => string }) {
  const v = section.visual;
  switch (v.type) {
    case "line": return <LineChart series={v.series} unit={v.unit} />;
    case "bars": return <BarList items={v.items} unit={v.unit} />;
    case "stacked": return <Stacked keys={v.keys} items={v.items} />;
    case "donut": return <Donut items={v.items} unit={v.unit} />;
    case "heatmap": return <Heatmap rows={v.rows} cols={v.cols} values={v.values} />;
    case "funnel": return <Funnel steps={v.steps} />;
    case "calendar": return <CalendarHeat days={v.days} />;
    case "progress": return <Progress items={v.items} />;
    case "beds": return <BedMap wards={v.wards} />;
    case "table": return <DataTable columns={v.columns} rows={v.rows} footnote={v.footnote} />;
    case "definitions": return <dl className="space-y-2 text-sm">{v.items.map((d) => <div key={d.key}><dt className="font-medium">{d.name}</dt><dd className="text-muted-foreground">{d.formula}{d.caveat ? ` — ${d.caveat}` : ""}</dd></div>)}</dl>;
  }
  void drillHref;
}

const WIDE = new Set(["table", "heatmap", "beds", "definitions", "calendar", "progress"]);

export function DashboardView({ endpoint, dashboard, drilldownBase = "/lab/analytics/drilldown", exportReport, initialTitle }: { endpoint: string; dashboard: string; drilldownBase?: string; exportReport?: string; initialTitle: string }) {
  const sp = useSearchParams();
  const query = useMemo(() => rangeQuery(new URLSearchParams(sp.toString())), [sp]);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`${endpoint}${query ? `?${query}` : ""}`, { signal, headers: { Accept: "application/json" } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Could not load analytics");
      setPayload(json); setError(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally { setLoading(false); }
  }, [endpoint, query]);

  // Fetching on mount and whenever the period changes synchronises with the server, which is what effects are for.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);
  useEffect(() => { if (!LIVE.has(dashboard)) return; const t = setInterval(() => void load(), 60_000); return () => clearInterval(t); }, [dashboard, load]);

  const drillHref = (key: string) => `${drilldownBase}?key=${encodeURIComponent(key)}${query ? `&${query}` : ""}`;
  const exportHref = (f: string) => `/api/facility/analytics/export?report=${exportReport}&format=${f}${query ? `&${query}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-xl font-semibold">{payload?.title ?? initialTitle}</h1>{payload && <p className="text-xs text-muted-foreground">{payload.facility.name}{payload.departmentScoped ? " · limited to your departments" : ""}{payload.cached ? " · cached" : ""} · updated {new Date(payload.computedAt).toLocaleString()}</p>}</div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {exportReport && (["csv", "xlsx", "pdf"] as const).map((f) => <a key={f} href={exportHref(f)} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">{f === "xlsx" ? "Excel" : f.toUpperCase()}</a>)}
          <button type="button" onClick={() => window.print()} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">Print</button>
        </div>
      </div>
      {!LIVE.has(dashboard) && <PeriodBar payload={payload} />}
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {loading && !payload && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>}
      {payload && (
        <>
          {payload.kpis.length > 0 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{payload.kpis.map((k) => <KpiCard key={k.key} k={k} drillHref={drillHref} />)}</div>}
          <div className="grid gap-4 lg:grid-cols-2">
            {payload.sections.map((s) => (
              <section key={s.id} className={`rounded-xl border bg-card p-4 ${WIDE.has(s.visual.type) ? "lg:col-span-2" : ""}`}>
                <div className="mb-3 flex items-start justify-between gap-2"><div><h2 className="text-sm font-semibold">{s.title}</h2><p className="text-xs text-muted-foreground">{s.question}</p></div>{s.drill && <Link href={drillHref(s.drill)} className="shrink-0 text-xs text-blue-600 hover:underline print:hidden">View records</Link>}</div>
                <Visual section={s} drillHref={drillHref} />
                {s.note && <p className="mt-2 text-xs text-muted-foreground">{s.note}</p>}
              </section>
            ))}
          </div>
          {payload.kpis.length === 0 && payload.sections.length === 0 && <Empty />}
          {payload.gaps.length > 0 && (
            <details className="rounded-xl border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-medium">Indicators not available yet ({payload.gaps.length})</summary>
              <p className="mt-2 text-xs text-muted-foreground">These indicators appear in the specification but Medic1905 does not record the underlying data, so they are not shown rather than estimated.</p>
              <ul className="mt-2 space-y-2">{payload.gaps.map((g) => <li key={g.indicator}><span className="font-medium">{g.indicator}.</span> <span className="text-muted-foreground">{g.reason}</span></li>)}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
