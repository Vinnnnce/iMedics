"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Index { dashboards: { key: string; label: string; description: string }[]; canManageTargets: boolean }

const GROUPS: { title: string; keys: string[] }[] = [
  { title: "Overview", keys: ["overview", "command-centre", "my-performance"] },
  { title: "Clinical", keys: ["hospital", "emergency", "mortality", "departments"] },
  { title: "Staff", keys: ["nursing", "doctors"] },
  { title: "Services", keys: ["laboratory", "diagnostic", "pharmacy"] },
  { title: "Management", keys: ["quality", "financial", "forecast"] },
];

export function AnalyticsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [index, setIndex] = useState<Index | null>(null);
  useEffect(() => { void fetch("/api/facility/analytics").then((r) => (r.ok ? r.json() : null)).then(setIndex).catch(() => setIndex(null)); }, []);
  const keep = ["preset", "from", "to", "compare", "compareFrom", "compareTo", "facilityId"].flatMap((k) => (sp.get(k) ? [`${k}=${encodeURIComponent(sp.get(k)!)}`] : [])).join("&");
  const suffix = keep ? `?${keep}` : "";
  const allowed = new Map(index?.dashboards.map((d) => [d.key, d]) ?? []);
  const link = (href: string, label: string) => <Link key={href} href={`${href}${suffix}`} className={`block whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm ${pathname === href ? "bg-blue-600 text-white" : "hover:bg-muted"}`}>{label}</Link>;
  return (
    <div className="mx-auto max-w-[1400px] p-3 sm:p-6 lg:grid lg:grid-cols-[220px_1fr] lg:gap-6">
      <nav aria-label="Analytics" className="mb-4 print:hidden lg:mb-0">
        <details className="rounded-xl border bg-card p-2 lg:hidden"><summary className="cursor-pointer px-2 py-1 text-sm font-medium">Analytics menu</summary><NavBody /></details>
        <div className="hidden lg:block"><NavBody /></div>
      </nav>
      <main className="min-w-0">{children}</main>
    </div>
  );
  function NavBody() {
    return (
      <div className="space-y-3 p-1">
        {GROUPS.map((g) => { const items = g.keys.filter((k) => allowed.has(k)); return items.length ? <div key={g.title}><p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>{items.map((k) => link(`/lab/analytics/${k}`, allowed.get(k)!.label))}</div> : null; })}
        <div><p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tools</p>{link("/lab/analytics/reports", "Reports")}{link("/lab/analytics/targets", "Targets")}{link("/lab/analytics/definitions", "Metric definitions")}</div>
      </div>
    );
  }
}
