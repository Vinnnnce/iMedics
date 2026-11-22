"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FlaskConical, Loader2, ScanLine, Search, TriangleAlert } from "lucide-react";
import type { InvestigationItemStatus, InvestigationPriority } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import { DOMAIN_META } from "@/lib/investigations/constants";
import { PriorityBadge, StatusBadge } from "./badges";

const TABS = [
  ["all", "All orders"], ["laboratory", "Laboratory"], ["diagnostic", "Diagnostic"], ["pending", "Pending"], ["in_progress", "In progress"],
  ["completed", "Completed"], ["released", "Released reports"], ["critical", "Critical results"], ["custom", "Custom requests"], ["drafts", "Drafts"],
] as const;
type Tab = (typeof TABS)[number][0];

interface Row {
  id: string; orderId: string; domain: "LABORATORY" | "DIAGNOSTIC"; nameSnapshot: string; isCustom: boolean; departmentKey: string; status: InvestigationItemStatus; priority: InvestigationPriority; createdAt: string;
  facility: { id: string; name: string | null } | null; order: { orderNumber: string; patient: { firstName: string; lastName: string; caseNumber: string } };
  resultAvailable: boolean; verificationStatus: string | null; criticalAlert: { id: string; status: string } | null;
}
interface DraftRow { id: string; orderNumber: string; domain: "LABORATORY" | "DIAGNOSTIC"; priority: InvestigationPriority; updatedAt: string; patient: { firstName: string; lastName: string; caseNumber: string }; items: { nameSnapshot: string }[] }

const ICON = { DIAGNOSTIC: ScanLine, LABORATORY: FlaskConical } as const;
const dept = (k: string) => k.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function DoctorHub({ openCriticalCount }: { openCriticalCount: number }) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      apiClient.get<{ items?: Row[]; drafts?: DraftRow[] }>(`/investigations/orders?tab=${tab}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`)
        .then((r) => { if (!cancelled) { setRows(r.items ?? []); setDrafts(r.drafts ?? []); } })
        .catch(() => { if (!cancelled) setError("Could not load orders"); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, q ? 250 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [tab, q]);

  return (
    <div className="space-y-6">
      <section aria-label="Order a new investigation" className="grid gap-4 md:grid-cols-2">
        {(["DIAGNOSTIC", "LABORATORY"] as const).map((d) => {
          const meta = DOMAIN_META[d];
          const Icon = ICON[d];
          return (
            <Link key={d} href={`/doctor/lab-requests/new?domain=${d}`} className="group rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <Card className="h-full transition group-hover:border-primary/50 group-hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-6" aria-hidden /></span>
                    <div>
                      <CardTitle className="text-xl uppercase tracking-wide">{meta.title}</CardTitle>
                      <CardDescription>{meta.subtitle}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">{meta.bullets.map((b) => <li key={b} className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary/60" aria-hidden />{b}</li>)}</ul>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">Open {meta.title.toLowerCase()} catalogue <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      {openCriticalCount > 0 && (
        <Link href="#orders" onClick={() => setTab("critical")} className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <TriangleAlert className="size-4" aria-hidden />
          <span className="font-medium">{openCriticalCount} critical result{openCriticalCount === 1 ? "" : "s"} awaiting your acknowledgement</span>
        </Link>
      )}

      <section id="orders" aria-label="Your orders" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Orders and results</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search orders" className="pl-8" placeholder="Patient, investigation or order no." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <div className="overflow-x-auto pb-1"><TabsList className="w-max">{TABS.map(([v, label]) => <TabsTrigger key={v} value={v}>{label}</TabsTrigger>)}</TabsList></div>
        </Tabs>

        {loading ? <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />Loading...</div>
          : error ? <p className="py-6 text-sm text-destructive">{error}</p>
          : tab === "drafts" ? (
            drafts.length === 0 ? <Empty text="No saved drafts." /> : (
              <ul className="divide-y rounded-xl border bg-card">
                {drafts.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div><p className="font-medium">{d.patient.firstName} {d.patient.lastName} <span className="text-xs text-muted-foreground">{d.patient.caseNumber}</span></p><p className="text-sm text-muted-foreground">{d.items.map((i) => i.nameSnapshot).join(", ")}</p></div>
                    <Link className={buttonVariants({ size: "sm", variant: "outline" })} href={`/doctor/lab-requests/new?domain=${d.domain}&draft=${d.id}`}>Continue editing</Link>
                  </li>
                ))}
              </ul>
            )
          ) : rows.length === 0 ? <Empty text="No orders in this view yet." />
          : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>{["Patient", "Investigation", "Facility / department", "Requested", "Priority", "Status", "Result"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2"><p className="font-medium">{r.order.patient.firstName} {r.order.patient.lastName}</p><p className="text-xs text-muted-foreground">{r.order.patient.caseNumber}</p></td>
                      <td className="px-3 py-2"><Link href={`/doctor/lab-requests/orders/${r.orderId}`} className="font-medium text-primary hover:underline">{r.nameSnapshot}</Link>{r.isCustom && <Badge variant="outline" className="ml-1.5">Custom</Badge>}<p className="text-xs text-muted-foreground">{r.order.orderNumber}</p></td>
                      <td className="px-3 py-2">{r.facility?.name ?? <span className="text-warning">No facility yet</span>}<p className="text-xs text-muted-foreground">{dept(r.departmentKey)}</p></td>
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2"><PriorityBadge priority={r.priority} /></td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2">
                        {r.criticalAlert && r.criticalAlert.status !== "ACKNOWLEDGED" && <Badge variant="destructive" className="mb-1"><TriangleAlert aria-hidden />Critical</Badge>}
                        <p className="text-xs">{r.resultAvailable ? <span className="text-success">Report released</span> : r.verificationStatus ? <span className="text-muted-foreground">In verification</span> : <span className="text-muted-foreground">Not available</span>}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">{text}</p>;
}
