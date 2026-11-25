import type { BedWard, Visual } from "@/lib/analytics/types";

/** Dependency-free SVG/HTML charts. Colours come from CSS variables so light and dark themes both work. */

const PALETTE = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#dc2626"];
export const colour = (i: number) => PALETTE[i % PALETTE.length];

export function fmt(v: number | null | undefined, unit = "count"): string {
  if (v === null || v === undefined) return "no data";
  const abs = Math.abs(v);
  const n = abs >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : abs >= 10_000 ? `${(v / 1_000).toFixed(1)}k` : Number.isInteger(v) ? String(v) : v.toFixed(unit === "percent" ? 1 : 2).replace(/\.?0+$/, "");
  return `${n}${unit === "percent" ? "%" : unit === "minutes" ? " min" : unit === "hours" ? " h" : unit === "days" ? " d" : ""}`;
}

export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 80, h = 24, max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} className={`h-6 w-20 ${className}`} role="img" aria-label="Trend over the period"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}

export function LineChart({ series, unit }: { series: Extract<Visual, { type: "line" }>["series"]; unit: string }) {
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort();
  const all = series.flatMap((s) => s.points.map((p) => p.y).filter((y): y is number => y !== null));
  if (!xs.length || !all.length) return <Empty />;
  const W = 640, H = 220, L = 40, R = 8, T = 10, B = 24;
  const max = Math.max(...all, 1), min = Math.min(0, ...all);
  const x = (i: number) => L + (xs.length === 1 ? (W - L - R) / 2 : (i / (xs.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - (v - min) / (max - min || 1)) * (H - T - B);
  const ticks = [0, 0.5, 1].map((t) => min + t * (max - min));
  const labelEvery = Math.max(1, Math.ceil(xs.length / 6));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Line chart">
        {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity="0.12" /><text x={L - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.6">{fmt(t, unit)}</text></g>)}
        {xs.map((label, i) => (i % labelEvery === 0 ? <text key={label} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6">{label.slice(5)}</text> : null))}
        {series.map((s, si) => {
          const segs: string[][] = [[]];
          xs.forEach((label, i) => { const p = s.points.find((q) => q.x === label); if (p && p.y !== null) segs[segs.length - 1].push(`${x(i)},${y(p.y)}`); else if (segs[segs.length - 1].length) segs.push([]); });
          return segs.filter((g) => g.length).map((g, gi) => g.length === 1
            ? <circle key={`${si}-${gi}`} cx={g[0].split(",")[0]} cy={g[0].split(",")[1]} r="2.5" fill={colour(si)} />
            : <polyline key={`${si}-${gi}`} points={g.join(" ")} fill="none" stroke={colour(si)} strokeWidth="2" strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />);
        })}
      </svg>
      {series.length > 1 && <Legend items={series.map((s) => s.name)} />}
    </div>
  );
}

export function Legend({ items }: { items: string[] }) {
  return <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{items.map((n, i) => <li key={n} className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: colour(i) }} />{n}</li>)}</ul>;
}

export function BarList({ items, unit }: { items: { label: string; value: number | null; previous?: number | null; drill?: string }[]; unit: string }) {
  if (!items.length) return <Empty />;
  const max = Math.max(...items.flatMap((i) => [i.value ?? 0, i.previous ?? 0]), 1);
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="text-sm">
          <div className="flex justify-between gap-2"><span className="truncate" title={i.label}>{i.label}</span><span className="shrink-0 font-medium tabular-nums">{i.value === null ? "hidden (<5)" : fmt(i.value, unit)}</span></div>
          <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-blue-600" style={{ width: `${((i.value ?? 0) / max) * 100}%` }} /></div>
          {i.previous !== undefined && i.previous !== null && <div className="mt-0.5 h-1 rounded bg-muted"><div className="h-1 rounded bg-muted-foreground/50" style={{ width: `${(i.previous / max) * 100}%` }} /></div>}
        </li>
      ))}
    </ul>
  );
}

export function Donut({ items, unit }: { items: { label: string; value: number }[]; unit: string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <Empty />;
  const r = 40, c = 2 * Math.PI * r;
  const arcs = items.map((i, idx) => ({ ...i, idx, len: (i.value / total) * c }));
  const offsets = arcs.map((_, k) => arcs.slice(0, k).reduce((sum, a) => sum + a.len, 0));
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90" role="img" aria-label="Proportions">
        {arcs.map((a, k) => <circle key={a.label} cx="50" cy="50" r={r} fill="none" stroke={colour(a.idx)} strokeWidth="16" strokeDasharray={`${a.len} ${c - a.len}`} strokeDashoffset={-offsets[k]} />)}
      </svg>
      <ul className="space-y-1 text-sm">
        {items.map((i, idx) => <li key={i.label} className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: colour(idx) }} /><span>{i.label}</span><span className="font-medium tabular-nums">{fmt(i.value, unit)}</span><span className="text-xs text-muted-foreground">({Math.round((i.value / total) * 100)}%)</span></li>)}
      </ul>
    </div>
  );
}

export function Heatmap({ rows, cols, values }: { rows: string[]; cols: string[]; values: (number | null)[][] }) {
  const max = Math.max(...values.flat().map((v) => v ?? 0), 1);
  if (max <= 0 || !rows.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="text-[10px]"><thead><tr><th />{cols.map((c) => <th key={c} className="px-0.5 font-normal text-muted-foreground">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={r}><th className="pr-2 text-left font-normal text-muted-foreground">{r}</th>{values[ri].map((v, ci) => <td key={ci} title={`${r} ${cols[ci]}:00 — ${v ?? "no data"}`} className="h-5 w-5 min-w-5 rounded-sm" style={{ background: v === null ? "transparent" : `rgba(37,99,235,${0.08 + 0.92 * (v / max)})` }} />)}</tr>)}</tbody></table>
    </div>
  );
}

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  if (!steps.some((s) => s.value)) return <Empty />;
  return (
    <ul className="space-y-1.5">
      {steps.map((s, i) => <li key={s.label} className="text-sm"><div className="flex justify-between"><span>{s.label}</span><span className="font-medium tabular-nums">{s.value}{i > 0 && steps[i - 1].value > 0 ? <span className="ml-1 text-xs text-muted-foreground">({Math.round((s.value / steps[i - 1].value) * 100)}% of previous)</span> : null}</span></div><div className="mt-0.5 h-5 rounded bg-blue-600/80" style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }} /></li>)}
    </ul>
  );
}

const STATUS_STYLE: Record<string, string> = { MET: "text-emerald-600", NEAR: "text-amber-600", MISSED: "text-red-600", NO_DATA: "text-muted-foreground" };
const STATUS_LABEL: Record<string, string> = { MET: "Target met", NEAR: "Close to target", MISSED: "Target missed", NO_DATA: "No data" };

export function Progress({ items }: { items: Extract<Visual, { type: "progress" }>["items"] }) {
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.key} className="text-sm">
          <div className="flex justify-between gap-2"><span>{i.label}</span><span className="tabular-nums">{fmt(i.actual, i.unit)} <span className="text-muted-foreground">/ {i.direction === "AT_LEAST" ? "≥" : "≤"} {fmt(i.target, i.unit)}</span></span></div>
          <div className="mt-1 h-2 rounded bg-muted"><div className={`h-2 rounded ${i.status === "MET" ? "bg-emerald-600" : i.status === "NEAR" ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${i.progressPercent ?? 0}%` }} /></div>
          <div className={`mt-0.5 text-xs ${STATUS_STYLE[i.status]}`}>{STATUS_LABEL[i.status]}</div>
        </li>
      ))}
    </ul>
  );
}

const BED_STYLE: Record<string, string> = { AVAILABLE: "bg-emerald-500", OCCUPIED: "bg-blue-600", RESERVED: "bg-violet-500", CLEANING: "bg-amber-400", MAINTENANCE: "bg-zinc-400", ISOLATION: "bg-red-500" };

export function BedMap({ wards }: { wards: BedWard[] }) {
  if (!wards.length) return <Empty text="No wards or beds are configured." />;
  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">{Object.keys(BED_STYLE).map((s) => <li key={s} className="flex items-center gap-1"><span className={`inline-block h-2.5 w-2.5 rounded-sm ${BED_STYLE[s]}`} />{s.toLowerCase()}</li>)}</ul>
      {wards.map((w) => (
        <div key={w.wardId}>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm"><span className="font-medium">{w.name}{w.className !== "GENERAL" ? <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">{w.className}</span> : null}</span><span className="text-xs text-muted-foreground">{w.occupied}/{w.inService} occupied{w.pendingDischarge ? ` · ${w.pendingDischarge} pending discharge` : ""}</span></div>
          <div className="flex flex-wrap gap-1">{w.beds.map((b) => <span key={b.id} title={`${b.label} — ${b.status.toLowerCase()}`} className={`flex h-7 min-w-9 items-center justify-center rounded px-1 text-[10px] font-medium text-white ${BED_STYLE[b.status]}`}>{b.label}</span>)}</div>
        </div>
      ))}
    </div>
  );
}

export function Empty({ text = "No data for this period." }: { text?: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

export function DataTable({ columns, rows, footnote }: { columns: { key: string; label: string; align?: "left" | "right" }[]; rows: Record<string, string | number | null>[]; footnote?: string }) {
  if (!rows.length) return <Empty />;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead><tr className="border-b text-xs text-muted-foreground">{columns.map((c) => <th key={c.key} className={`px-2 py-1.5 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-b last:border-0">{columns.map((c) => <td key={c.key} className={`px-2 py-1.5 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>{r[c.key] === null || r[c.key] === undefined ? <span className="text-muted-foreground">—</span> : String(r[c.key])}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {footnote && <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}

export function CalendarHeat({ days }: { days: { date: string; value: number }[] }) {
  const max = Math.max(...days.map((d) => d.value), 1);
  if (!days.length) return <Empty />;
  return <div className="flex flex-wrap gap-0.5">{days.map((d) => <span key={d.date} title={`${d.date}: ${d.value}`} className="h-4 w-4 rounded-sm" style={{ background: `rgba(37,99,235,${0.08 + 0.92 * (d.value / max)})` }} />)}</div>;
}

export function Stacked({ keys, items }: { keys: string[]; items: { label: string; values: Record<string, number> }[] }) {
  const max = Math.max(...items.map((i) => keys.reduce((s, k) => s + (i.values[k] ?? 0), 0)), 1);
  if (!items.length) return <Empty />;
  return (
    <div>
      <ul className="space-y-1.5">{items.map((i) => <li key={i.label} className="text-sm"><div className="flex justify-between"><span>{i.label}</span><span className="tabular-nums">{keys.reduce((s, k) => s + (i.values[k] ?? 0), 0)}</span></div><div className="flex h-3 overflow-hidden rounded bg-muted">{keys.map((k, ki) => <div key={k} style={{ width: `${((i.values[k] ?? 0) / max) * 100}%`, background: colour(ki) }} title={`${k}: ${i.values[k] ?? 0}`} />)}</div></li>)}</ul>
      <Legend items={keys} />
    </div>
  );
}
