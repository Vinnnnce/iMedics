"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Clock, Loader2, Search, TestTube2 } from "lucide-react";
import type { InvestigationItemStatus, InvestigationPriority } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { PriorityBadge, StatusBadge } from "../badges";

interface Analytics { open: number; overdue: number; releasedLast30Days: number; avgTurnaroundHours: number | null; onTimePercent: number | null; rejectedSpecimens30Days: number; openCriticalAlerts: number }
interface Row {
  id: string; domain: "LABORATORY" | "DIAGNOSTIC"; departmentKey: string; nameSnapshot: string; isCustom: boolean; status: InvestigationItemStatus; priority: InvestigationPriority; dueAt: string | null; scheduledAt: string | null; overdue: boolean; nextAction: string | null;
  order: { orderNumber: string; requestedBy: { name: string }; patient: { firstName: string; lastName: string; caseNumber: string } }; specimens: { barcode: string; status: string }[];
}
interface Props { domains: ("LABORATORY" | "DIAGNOSTIC")[]; categories: { domain: "LABORATORY" | "DIAGNOSTIC"; key: string; name: string }[]; analytics: Analytics; canManageCatalogue: boolean }

const VIEWS = [["all", "All open"], ["new", "New requests"], ["specimens", "Specimens"], ["processing", "Processing"], ["results", "Result entry"], ["verification", "Verification"], ["overdue", "Overdue"], ["amendments", "Amendments"], ["completed", "Completed"]] as const;

export function ResultsCentre({ domains, categories, analytics, canManageCatalogue }: Props) {
  const [domain, setDomain] = useState<"LABORATORY" | "DIAGNOSTIC">(domains[0]);
  const [department, setDepartment] = useState<string | null>(null);
  const [view, setView] = useState<(typeof VIEWS)[number][0]>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<{ domain: string; department: string; open: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      const p = new URLSearchParams({ domain, view });
      if (department) p.set("department", department);
      if (q.trim()) p.set("q", q.trim());
      apiClient.get<{ items: Row[]; departmentCounts: typeof counts }>(`/facility/investigations/worklist?${p}`).then((r) => { if (!cancelled) { setRows(r.items); setCounts(r.departmentCounts); } }).catch(() => undefined).finally(() => { if (!cancelled) setLoading(false); });
    }, q ? 250 : 0);
    const poll = setInterval(() => { /* keep worklists fresh without a manual refresh */ apiClient.get<{ items: Row[]; departmentCounts: typeof counts }>(`/facility/investigations/worklist?${new URLSearchParams({ domain, view, ...(department ? { department } : {}), ...(q.trim() ? { q: q.trim() } : {}) })}`).then((r) => { if (!cancelled) { setRows(r.items); setCounts(r.departmentCounts); } }).catch(() => undefined); }, 30_000);
    return () => { cancelled = true; clearTimeout(t); clearInterval(poll); };
  }, [domain, department, view, q]);

  const depts = useMemo(() => categories.filter((c) => c.domain === domain), [categories, domain]);
  const openByDept = (key: string) => counts.find((c) => c.domain === domain && c.department === key)?.open ?? 0;

  const stats = [
    { label: "Open", value: analytics.open, icon: TestTube2 },
    { label: "Overdue", value: analytics.overdue, icon: Clock, tone: analytics.overdue ? "text-destructive" : "" },
    { label: "Released (30 d)", value: analytics.releasedLast30Days, icon: BarChart3 },
    { label: "Avg turnaround", value: analytics.avgTurnaroundHours != null ? `${analytics.avgTurnaroundHours} h` : "-", icon: Clock },
    { label: "On time", value: analytics.onTimePercent != null ? `${analytics.onTimePercent}%` : "-", icon: BarChart3 },
    { label: "Critical open", value: analytics.openCriticalAlerts, icon: AlertTriangle, tone: analytics.openCriticalAlerts ? "text-destructive" : "" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}><CardContent className="flex items-center gap-3 p-3"><s.icon className={`size-5 text-muted-foreground ${s.tone ?? ""}`} aria-hidden /><div><p className={`text-xl font-semibold leading-none ${s.tone ?? ""}`}>{s.value}</p><p className="mt-1 text-xs text-muted-foreground">{s.label}</p></div></CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {domains.length > 1 ? (
          <Tabs value={domain} onValueChange={(v) => { setDomain(v as typeof domain); setDepartment(null); }}><TabsList><TabsTrigger value="LABORATORY">Laboratory</TabsTrigger><TabsTrigger value="DIAGNOSTIC">Diagnostic centre</TabsTrigger></TabsList></Tabs>
        ) : <h2 className="text-lg font-semibold">{domain === "LABORATORY" ? "Laboratory" : "Diagnostic centre"} worklists</h2>}
        <div className="flex flex-wrap items-center gap-2">
          <Link className={buttonVariants({ size: "sm", variant: "outline" })} href="/lab/results-reports/critical"><AlertTriangle aria-hidden />Critical alerts</Link>
          {canManageCatalogue && <Link className={buttonVariants({ size: "sm", variant: "outline" })} href="/lab/results-reports/catalogue">Service catalogue</Link>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Departments">
        <button type="button" onClick={() => setDepartment(null)} className={`rounded-full border px-3 py-1 text-sm transition ${department === null ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>All departments</button>
        {depts.map((d) => (
          <button key={d.key} type="button" onClick={() => setDepartment(department === d.key ? null : d.key)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${department === d.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
            {d.name}{openByDept(d.key) > 0 && <Badge variant="secondary" className="h-4 px-1.5">{openByDept(d.key)}</Badge>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="overflow-x-auto"><Tabs value={view} onValueChange={(v) => setView(v as typeof view)}><TabsList className="w-max">{VIEWS.map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}</TabsList></Tabs></div>
        <div className="relative w-full sm:w-72"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input aria-label="Search worklist" className="pl-8" placeholder="Patient, test, order or barcode" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {loading && rows.length === 0 ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Loading worklist...</div>
        : rows.length === 0 ? <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">Nothing in this worklist.</p>
        : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Priority", "Patient", "Investigation", "Department", "Status", "Due", "Next step"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className={`hover:bg-muted/40 ${r.overdue ? "bg-destructive/5" : ""}`}>
                    <td className="px-3 py-2"><PriorityBadge priority={r.priority} /></td>
                    <td className="px-3 py-2"><p className="font-medium">{r.order.patient.firstName} {r.order.patient.lastName}</p><p className="text-xs text-muted-foreground">{r.order.patient.caseNumber}</p></td>
                    <td className="px-3 py-2"><Link href={`/lab/results-reports/items/${r.id}`} className="font-medium text-primary hover:underline">{r.nameSnapshot}</Link>{r.isCustom && <Badge variant="outline" className="ml-1.5">Custom</Badge>}<p className="text-xs text-muted-foreground">{r.order.orderNumber}{r.specimens[0] ? ` · ${r.specimens[0].barcode}` : ""}</p></td>
                    <td className="px-3 py-2 capitalize">{r.departmentKey.replace(/-/g, " ")}</td>
                    <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.scheduledAt ? <span>{new Date(r.scheduledAt).toLocaleString()}</span> : r.dueAt ? <span className={r.overdue ? "font-medium text-destructive" : ""}>{new Date(r.dueAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}{r.overdue && " (overdue)"}</span> : "-"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.nextAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
