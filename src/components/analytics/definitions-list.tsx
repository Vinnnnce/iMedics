"use client";

import { useEffect, useState } from "react";
import type { MetricDefinition } from "@/lib/analytics/registry";

export function DefinitionsList() {
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void fetch("/api/facility/analytics/metrics").then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j?.error ?? "Could not load definitions"); setMetrics(j.metrics); }).catch((e: Error) => setError(e.message)); }, []);
  const shown = metrics.filter((m) => `${m.name} ${m.module} ${m.description}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-semibold">Metric definitions</h1><p className="text-sm text-muted-foreground">How every statistic is calculated: formula, numerator and denominator, source, the date that places a record in a period, and what is included or excluded.</p></div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search metrics" className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:max-w-sm" aria-label="Search metrics" />
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      <ul className="space-y-3">
        {shown.map((m) => (
          <li key={m.key} className="rounded-xl border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">{m.name}</h2><span className="text-xs text-muted-foreground">{m.module.toLowerCase()} · {m.unit} · updated {m.lastUpdated}</span></div>
            <p className="mt-1 text-muted-foreground">{m.description}</p>
            <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[120px_1fr]">
              <dt className="text-muted-foreground">Formula</dt><dd>{m.formula}</dd>
              {m.numerator && <><dt className="text-muted-foreground">Numerator</dt><dd>{m.numerator}</dd></>}
              {m.denominator && <><dt className="text-muted-foreground">Denominator</dt><dd>{m.denominator}</dd></>}
              <dt className="text-muted-foreground">Data source</dt><dd>{m.dataSource}</dd>
              <dt className="text-muted-foreground">Counted on</dt><dd>{m.eventDate}</dd>
              <dt className="text-muted-foreground">Included</dt><dd>{m.inclusion}</dd>
              <dt className="text-muted-foreground">Excluded</dt><dd>{m.exclusion}</dd>
              {m.caveat && <><dt className="text-amber-600">Caveat</dt><dd>{m.caveat}</dd></>}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
