import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Pagination, ROLE_LABEL, inputClass, selectClass } from "@/components/admin/ui";
import { AUDIT_PAGE_SIZE, auditFilterSchema, listAudit } from "@/lib/admin/audit-log";
import { ACTION_GROUPS, describeAction } from "@/lib/admin/audit-labels";
import { firstValues, withParams, type SearchParams } from "@/lib/admin/params";
import { formatClinicDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = auditFilterSchema.parse(firstValues(await searchParams));
  const { rows, total, pageCount } = await listAudit(filters);
  const current = { q: filters.q, group: filters.group, role: filters.role, from: filters.from, to: filters.to };
  const hasFilters = Object.values(current).some(Boolean);

  return (
    <>
      <PageHeader
        title="Activity log"
        description="A permanent record of who did what: sign-ups, record access, payments and every administrator action."
        actions={<a href={withParams("/api/admin/export/audit", current, {})} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted"><Download className="h-4 w-4" /> Export CSV</a>}
      />

      <form action="/admin/activity" className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={filters.q} placeholder="Action, person or record ID" className={cn(inputClass, "w-64 pl-9")} />
        </div>
        <select name="group" defaultValue={filters.group ?? ""} className={selectClass} aria-label="Category">
          <option value="">All categories</option>
          {Object.entries(ACTION_GROUPS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}
        </select>
        <select name="role" defaultValue={filters.role ?? ""} className={selectClass} aria-label="Actor role">
          <option value="">Any role</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" name="from" defaultValue={filters.from} className={inputClass} aria-label="From date" />
        <input type="date" name="to" defaultValue={filters.to} className={inputClass} aria-label="To date" />
        <button className="h-9 rounded-lg bg-foreground px-4 text-sm text-background">Apply</button>
        {hasFilters && <Link href="/admin/activity" className="inline-flex h-9 items-center px-2 text-sm underline">Clear</Link>}
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No activity matches" hint="Adjust or clear the filters." />
      ) : (
        <>
          <Card className="beeline-card overflow-x-auto p-0">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Who</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Record</th>
                  <th className="px-4 py-3 font-medium">IP address</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const details = a.details && typeof a.details === "object" && Object.keys(a.details as object).length > 0 ? JSON.stringify(a.details, null, 2) : null;
                  return (
                    <tr key={a.id} className="border-b border-border align-top last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatClinicDateTime(a.createdAt)}</td>
                      <td className="px-4 py-3">
                        {a.user ? <Link href={`/admin/users/${a.user.id}`} className="font-medium hover:underline">{a.user.name}</Link> : <span className="text-muted-foreground">System</span>}
                        {a.actorRole && <span className="block text-xs text-muted-foreground">{ROLE_LABEL[a.actorRole]}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{describeAction(a.action)}</span>
                        {details && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-muted-foreground">Details</summary>
                            <pre className="mt-1 max-w-sm overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px]">{details}</pre>
                          </details>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {a.resourceType}
                        {a.resourceId && a.resourceType === "User" && <Link href={`/admin/users/${a.resourceId}`} className="block text-xs underline">Open</Link>}
                        {a.resourceId && a.resourceType === "Payment" && <Link href={`/admin/payments/${a.resourceId}`} className="block text-xs underline">Open</Link>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.ipAddress ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <Pagination base="/admin/activity" params={current} page={filters.page} pageCount={pageCount} total={total} pageSize={AUDIT_PAGE_SIZE} />
        </>
      )}
    </>
  );
}
