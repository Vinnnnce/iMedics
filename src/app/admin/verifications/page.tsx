import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, Pagination, TYPE_LABEL, VerificationBadge, ago, inputClass, selectClass } from "@/components/admin/ui";
import { APPLICATION_PAGE_SIZE, applicationFilterSchema, listApplications } from "@/lib/admin/applications";
import { firstValues, withParams, type SearchParams } from "@/lib/admin/params";
import { cn } from "@/lib/utils";

const TABS = [["PENDING", "Awaiting review"], ["REJECTED", "Changes requested"], ["VERIFIED", "Verified"], ["ALL", "All"]] as const;

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = firstValues(await searchParams);
  const filters = applicationFilterSchema.parse(raw);
  const { rows, total, pageCount, tabCounts } = await listApplications(filters);
  const current = { status: filters.status === "PENDING" ? undefined : filters.status, type: filters.type, q: filters.q };

  return (
    <>
      <PageHeader title="Verifications" description="Review doctors and facilities that registered. Open an application to see everything they submitted." />

      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={withParams("/admin/verifications", { type: filters.type, q: filters.q }, { status: key === "PENDING" ? undefined : key })}
            role="tab"
            aria-selected={filters.status === key}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium", filters.status === key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {label} <span className="ml-1 text-xs text-muted-foreground">{tabCounts[key]}</span>
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap gap-2" action="/admin/verifications">
        {filters.status !== "PENDING" && <input type="hidden" name="status" value={filters.status} />}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={filters.q} placeholder="Search name, email or phone" className={cn(inputClass, "w-64 pl-9")} />
        </div>
        <select name="type" defaultValue={filters.type ?? ""} className={selectClass} aria-label="Applicant type">
          <option value="">Doctors and facilities</option>
          <option value="DOCTOR">Doctors</option>
          <option value="FACILITY">Facilities</option>
        </select>
        <button className="h-9 rounded-lg bg-foreground px-4 text-sm text-background">Filter</button>
        {(filters.q || filters.type) && <Link href={withParams("/admin/verifications", {}, { status: current.status })} className="inline-flex h-9 items-center px-2 text-sm underline">Clear</Link>}
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No applications here" hint={filters.status === "PENDING" ? "New registrations from doctors and facilities will appear in this queue." : "Try another tab or clear your filters."} />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link key={r.id} href={`/admin/verifications/${r.id}`} className="block">
              <Card className="beeline-card transition-colors hover:bg-muted/40">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{r.name}</p>
                      <span className="rounded-lg bg-muted px-2 py-0.5 text-xs">{r.accountType ? TYPE_LABEL[r.accountType] : r.type === "DOCTOR" ? "Doctor" : "Facility"}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{[r.headline, r.email].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {r.documents} document{r.documents === 1 ? "" : "s"}</span>
                    <span>Registered {ago(r.submittedAt)}</span>
                    <VerificationBadge status={r.status} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          <Pagination base="/admin/verifications" params={current} page={filters.page} pageCount={pageCount} total={total} pageSize={APPLICATION_PAGE_SIZE} />
        </div>
      )}
    </>
  );
}
