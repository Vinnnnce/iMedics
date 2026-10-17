import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, Pagination, StatCard, inputClass, selectClass } from "@/components/admin/ui";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { PAYMENT_PAGE_SIZE, listPayments, paymentFilterSchema } from "@/lib/admin/payments";
import { firstValues, withParams, type SearchParams } from "@/lib/admin/params";
import { formatClinicDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = paymentFilterSchema.parse(firstValues(await searchParams));
  const { rows, total, pageCount, totals } = await listPayments(filters);
  const current = { q: filters.q, status: filters.status, kind: filters.kind, from: filters.from, to: filters.to };
  const hasFilters = Object.values(current).some(Boolean);

  // Money actually held: successful plus refund-in-progress. Shown per currency, never summed across currencies.
  const currencies = [...new Set(totals.map((t) => t.currency))];
  const sum = (currency: string, statuses: string[]) => totals.filter((t) => t.currency === currency && statuses.includes(t.status)).reduce((a, t) => a + t.amount, 0);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every transaction on the platform. Totals reflect your current filters."
        actions={<a href={withParams("/api/admin/export/payments", current, {})} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm hover:bg-muted"><Download className="h-4 w-4" /> Export CSV</a>}
      />

      {currencies.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {currencies.map((c) => (
            <div key={c} className="contents">
              <StatCard label={`Collected (${c})`} value={formatMoney(sum(c, ["SUCCESSFUL", "REFUND_PENDING"]), c)} />
              <StatCard label={`Refunded (${c})`} value={formatMoney(sum(c, ["REFUNDED"]), c)} />
            </div>
          ))}
        </div>
      )}

      <form action="/admin/payments" className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input name="q" defaultValue={filters.q} placeholder="Receipt, reference or name" className={cn(inputClass, "w-60 pl-9")} />
        </div>
        <select name="status" defaultValue={filters.status ?? ""} className={selectClass} aria-label="Status">
          <option value="">Any status</option>
          {["SUCCESSFUL", "PENDING", "FAILED", "REFUND_PENDING", "REFUNDED", "CANCELLED"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
        </select>
        <select name="kind" defaultValue={filters.kind ?? ""} className={selectClass} aria-label="Type">
          <option value="">Consultations and services</option>
          <option value="CONSULTATION">Consultations</option>
          <option value="FACILITY_SERVICE">Facility services</option>
        </select>
        <input type="date" name="from" defaultValue={filters.from} className={inputClass} aria-label="From date" />
        <input type="date" name="to" defaultValue={filters.to} className={inputClass} aria-label="To date" />
        <button className="h-9 rounded-lg bg-foreground px-4 text-sm text-background">Apply</button>
        {hasFilters && <Link href="/admin/payments" className="inline-flex h-9 items-center px-2 text-sm underline">Clear</Link>}
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No payments match" hint="Adjust or clear the filters." />
      ) : (
        <>
          <Card className="beeline-card overflow-x-auto p-0">
            <CardContent className="p-0">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Payer → payee</th>
                    <th className="px-4 py-3 font-medium">For</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground"><Link href={`/admin/payments/${p.id}`} className="underline-offset-2 hover:underline">{formatClinicDateTime(p.createdAt)}</Link></td>
                      <td className="px-4 py-3">{p.payer.name} <span className="text-muted-foreground">→</span> {p.payee.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.description}{p.receiptNumber && <span className="block text-xs">{p.receiptNumber}</span>}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                      <td className="px-4 py-3"><PaymentStatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Pagination base="/admin/payments" params={current} page={filters.page} pageCount={pageCount} total={total} pageSize={PAYMENT_PAGE_SIZE} />
        </>
      )}
    </>
  );
}
