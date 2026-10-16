"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar } from "@/components/shared/filter-bar";
import { StatusChip } from "@/components/shared/status-chip";
import { ErrorState } from "@/components/shared/async-state";
import { apiClient } from "@/lib/api-client";
import type { WorkspaceItem } from "@/lib/workspace/types";
import { safeNotificationHref } from "@/lib/notifications/safe-href";
import { filterWorkspaceItems } from "@/lib/workspace/filters";

export function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <Card className="beeline-card min-w-0"><CardHeader className="flex flex-wrap items-start justify-between gap-3">
    <h2 className="text-base font-semibold">{title}</h2>{action}
  </CardHeader><CardContent className="space-y-4">{children}</CardContent></Card>;
}
export function useDashboardMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function run(work: () => Promise<void>, success: string) {
    if (busy || !navigator.onLine) { setError("Reconnect before saving changes."); return false; }
    setBusy(true); setError("");
    try { await work(); toast.success(success); router.refresh(); return true; }
    catch (e) { const message = e instanceof Error ? e.message : "Unable to save. Please try again."; setError(message); toast.error(message); return false; }
    finally { setBusy(false); }
  }
  return { busy, error, run, errorUI: error ? <ErrorState title="Action not completed" detail={error} /> : null };
}
export async function downloadCsv(endpoint: string, fileName: string) {
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error("Export failed. Please retry.");
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ItemTable({ items, title, actions, exportSection }: {
  items: readonly WorkspaceItem[]; title: string; actions?: (item: WorkspaceItem) => ReactNode;
  exportSection?: "appointments" | "results" | "payments" | "timeline" | "operations";
}) {
  const [search, setSearch] = useState(""), [range, setRange] = useState({ from: "", to: "" });
  const [status, setStatus] = useState("all"), [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ id: string; direction: "asc" | "desc" }>({ id: "at", direction: "desc" });
  const filtered = filterWorkspaceItems(items, { search, status, ...range }).sort((a, b) => {
    const value = sort.id === "title" ? a.title.localeCompare(b.title) : (a.at ?? "").localeCompare(b.at ?? "");
    return sort.direction === "asc" ? value : -value;
  });
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)));
  const mutation = useDashboardMutation();
  return <div className="space-y-4">
    <FilterBar search={search} onSearchChange={value => { setSearch(value); setPage(1); }} searchLabel={`Search ${title.toLowerCase()} or case number`}
      from={range.from} to={range.to} onDateChange={value => { setRange(value); setPage(1); }}>
      <label className="space-y-2 text-sm"><span>Status</span><select aria-label={`${title} status`} className="block h-10 w-full rounded-lg border border-input bg-background px-2" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
        <option value="all">All statuses</option>{Array.from(new Set(items.map(item => item.status))).map(value => <option key={value}>{value}</option>)}
      </select></label>
      {exportSection && <Button variant="outline" disabled={mutation.busy} onClick={() => {
        if (!window.confirm("Export these authorized records to this device? The file may contain sensitive information. Keep it secure.")) return;
        void mutation.run(async () => {
          const query = new URLSearchParams({ section: exportSection, search, status, ...range });
          await downloadCsv(`/api/workspace/report?${query}`, `imedics-${exportSection}.csv`);
        }, "Export downloaded");
      }}>Export CSV</Button>}
    </FilterBar>
    {mutation.errorUI}
    <p className="text-xs text-muted-foreground">{filtered.length} matching records from the latest {items.length} loaded records. Dates shown in clinic time (WAT); date filters use UTC calendar dates.</p>
    <DataTable rows={filtered.slice((currentPage - 1) * 8, currentPage * 8)} caption={title} rowKey={row => row.id} sort={sort} onSort={setSort}
      page={currentPage} hasNext={currentPage * 8 < filtered.length} onPageChange={setPage}
      columns={[
        { id: "title", header: "Details", sortable: true, cell: item => <div className="min-w-36 space-y-1"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.subtitle}</p>{item.caseNumber && <p className="text-xs text-muted-foreground">Case {item.caseNumber}</p>}</div> },
        { id: "at", header: "Date", sortable: true, cell: item => item.at ? new Date(item.at).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" }) : "Not scheduled" },
        { id: "status", header: "Status", cell: item => <StatusChip tone={item.tone === "red" ? "danger" : item.tone === "green" ? "success" : item.tone === "amber" ? "warning" : "neutral"}>{item.status}</StatusChip> },
        { id: "actions", header: "Actions", cell: item => actions ? actions(item) : item.href ? <Link className="rounded-sm text-sm underline" href={safeNotificationHref(item.href)}>Open</Link> : <span className="text-xs text-muted-foreground">No action required</span> },
      ]} />
  </div>;
}
export { apiClient };
