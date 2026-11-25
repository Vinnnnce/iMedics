"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DrilldownPage } from "@/lib/analytics/types";
import { DataTable } from "./charts";
import { rangeQuery } from "./dashboard-view";

export function DrilldownTable({ canIdentify }: { canIdentify: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const key = sp.get("key") ?? "";
  const page = Number(sp.get("page") ?? 1) || 1;
  const identified = sp.get("identified") === "1";
  const range = rangeQuery(new URLSearchParams(sp.toString()));
  const [data, setData] = useState<DrilldownPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = new AbortController();
    void fetch(`/api/facility/analytics/drilldown?key=${encodeURIComponent(key)}&page=${page}&identified=${identified ? 1 : 0}${range ? `&${range}` : ""}`, { signal: c.signal })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j?.error ?? "Could not load records"); setData(j); setError(null); })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message); });
    return () => c.abort();
  }, [key, page, identified, range]);

  const go = (patch: Record<string, string>) => { const n = new URLSearchParams(sp.toString()); for (const [k, v] of Object.entries(patch)) n.set(k, v); router.replace(`/lab/analytics/drilldown?${n.toString()}`); };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><button type="button" onClick={() => router.back()} className="text-xs text-blue-600 hover:underline">← Back to dashboard</button><h1 className="text-xl font-semibold">{data?.title ?? "Records"}</h1>{data && <p className="text-xs text-muted-foreground">{data.period.label} ({data.period.startDate} to {data.period.endDate}) · {data.total} record{data.total === 1 ? "" : "s"}</p>}</div>
        {canIdentify && <button type="button" onClick={() => go({ identified: identified ? "0" : "1", page: "1" })} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">{identified ? "Hide case numbers" : "Show case numbers"}</button>}
      </div>
      <p className="rounded-lg border bg-muted/40 p-2 text-xs text-muted-foreground">Records are de-identified by default. Showing case numbers is recorded in the audit trail. Figures here use the same period and filters as the dashboard you came from.</p>
      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</div>}
      {data && <div className="rounded-xl border bg-card p-3"><DataTable columns={data.columns.map((c) => ({ key: c.key, label: c.label }))} rows={data.rows} /></div>}
      {data && pages > 1 && <div className="flex items-center justify-between text-sm"><button disabled={page <= 1} onClick={() => go({ page: String(page - 1) })} className="rounded-md border px-3 py-1 disabled:opacity-40">Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages} onClick={() => go({ page: String(page + 1) })} className="rounded-md border px-3 py-1 disabled:opacity-40">Next</button></div>}
      <Link href="/lab/analytics" className="sr-only">Analytics home</Link>
    </div>
  );
}
