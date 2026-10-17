import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Pagination, ROLE_LABEL, TYPE_LABEL, UserStatusBadge, VerificationBadge, inputClass, selectClass } from "@/components/admin/ui";
import { PAGE_SIZE, listUsers, userFilterSchema } from "@/lib/admin/users";
import { firstValues, withParams, type SearchParams } from "@/lib/admin/params";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = firstValues(await searchParams);
  const filters = userFilterSchema.parse(raw);
  const { rows, total, pageCount } = await listUsers(filters);
  const current = { q: filters.q, role: filters.role, status: filters.status, type: filters.type, verification: filters.verification, sort: filters.sort };
  const exportHref = withParams("/api/admin/export/users", current, {});
  const hasFilters = Object.values(current).some(Boolean);

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone registered on the platform. Open an account for details and controls."
        actions={<a href={exportHref} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted"><Download className="h-4 w-4" /> Export CSV</a>}
      />

      <form action="/admin/users" className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={filters.q} placeholder="Name, email or phone" className={cn(inputClass, "w-60 pl-9")} />
        </div>
        <select name="role" defaultValue={filters.role ?? ""} className={selectClass} aria-label="Role">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="type" defaultValue={filters.type ?? ""} className={selectClass} aria-label="Account type">
          <option value="">All account types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="status" defaultValue={filters.status ?? ""} className={selectClass} aria-label="Status">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
        </select>
        <select name="verification" defaultValue={filters.verification ?? ""} className={selectClass} aria-label="Verification">
          <option value="">Any verification</option>
          <option value="PENDING">Awaiting review</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Changes requested</option>
        </select>
        <select name="sort" defaultValue={filters.sort ?? "newest"} className={selectClass} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
          <option value="active">Recently active</option>
        </select>
        <button className="h-9 rounded-lg bg-foreground px-4 text-sm text-background">Apply</button>
        {hasFilters && <Link href="/admin/users" className="inline-flex h-9 items-center px-2 text-sm underline">Clear</Link>}
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No users match" hint="Adjust or clear the filters." />
      ) : (
        <>
          <Card className="beeline-card overflow-x-auto p-0">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Verification</th>
                  <th className="px-4 py-3 font-medium">Registered</th>
                  <th className="px-4 py-3 font-medium">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="block">
                        <span className="font-medium">{u.name}</span>
                        <span className="block text-xs text-muted-foreground">{[u.email, u.headline].filter(Boolean).join(" · ")}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">{ROLE_LABEL[u.role]}{u.accountType && u.accountType !== "PATIENT" && u.accountType !== "DOCTOR" ? <span className="block text-xs text-muted-foreground">{TYPE_LABEL[u.accountType]}</span> : null}</td>
                    <td className="px-4 py-3"><UserStatusBadge status={u.status} /></td>
                    <td className="px-4 py-3"><VerificationBadge status={u.verificationStatus} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination base="/admin/users" params={current} page={filters.page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} />
        </>
      )}
    </>
  );
}
