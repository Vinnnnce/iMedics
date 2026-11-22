"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Point { id: string; value: number; unit: string | null; refLow: number | null; refHigh: number | null; flag: string | null; at: string; investigation: string }

/** Chronological comparison of one numeric analyte across released reports, with the reference band. */
export function TrendChart({ patientId, analyteCode, name }: { patientId: string; analyteCode?: string; name: string }) {
  const [points, setPoints] = useState<Point[] | null>(null);
  useEffect(() => {
    const q = new URLSearchParams({ patientId });
    if (analyteCode) q.set("analyteCode", analyteCode); else q.set("name", name);
    apiClient.get<{ points: Point[] }>(`/investigations/trend?${q}`).then((r) => setPoints(r.points)).catch(() => setPoints([]));
  }, [patientId, analyteCode, name]);

  if (!points) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Loading previous results...</div>;
  if (points.length < 2) return <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">No earlier released results of {name} to compare with.</p>;

  const W = 560, H = 160, P = 28;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals, ...points.map((p) => p.refLow ?? Infinity).filter(Number.isFinite));
  const hi = Math.max(...vals, ...points.map((p) => p.refHigh ?? -Infinity).filter(Number.isFinite));
  const span = hi - lo || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v: number) => H - P - ((v - lo) / span) * (H - 2 * P);
  const last = points[points.length - 1];
  const band = last.refLow != null && last.refHigh != null ? { top: y(last.refHigh), bottom: y(last.refLow) } : null;

  return (
    <figure className="rounded-lg border p-3">
      <figcaption className="mb-1 text-sm font-medium">{name} over time{last.unit ? ` (${last.unit})` : ""}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name} trend: ${points.map((p) => `${p.value} on ${new Date(p.at).toLocaleDateString()}`).join(", ")}`} className="h-auto w-full">
        {band && <rect x={P} y={band.top} width={W - 2 * P} height={Math.max(0, band.bottom - band.top)} className="fill-success/10" />}
        <polyline fill="none" strokeWidth={2} className="stroke-primary" points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} />
        {points.map((p, i) => (
          <g key={p.id}>
            <circle cx={x(i)} cy={y(p.value)} r={4} className={p.flag && p.flag !== "NORMAL" ? "fill-destructive" : "fill-primary"} />
            <text x={x(i)} y={y(p.value) - 8} textAnchor="middle" className="fill-foreground text-[10px]">{p.value}</text>
            <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[9px]">{new Date(p.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</text>
          </g>
        ))}
      </svg>
      {band && <p className="text-xs text-muted-foreground">Shaded band: latest reference range.</p>}
    </figure>
  );
}
