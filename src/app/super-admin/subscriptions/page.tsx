import { CreditCard, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "SUBSCRIPTIONS");
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const [plans, active, expired, trial, revenueMonth, revenueYear, refundsOpen] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true, monthlyPrice: true, currency: true, consultationAllowance: true, active: true, _count: { select: { subscriptions: true } } } }),
    prisma.doctorSubscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { gt: now } } }),
    prisma.doctorSubscription.count({ where: { currentPeriodEnd: { lte: now } } }),
    prisma.doctorSubscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { gt: now }, plan: { monthlyPrice: 0 } } }),
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL", paidAt: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL", paidAt: { gte: startOfYear } }, _sum: { amount: true } }),
    prisma.refund.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }),
  ]);
  const rev = (s: { _sum: { amount: unknown } }) => (s._sum.amount ? formatMoney(String(s._sum.amount), "NGN") : "—");

  return <>
    <PageHeader title="Subscription & Billing" description="Plans, subscriptions and revenue across the platform" />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatCard label="Active subscriptions" value={active.toLocaleString()} />
      <StatCard label="Expired" value={expired.toLocaleString()} />
      <StatCard label="Free-trial / free plans" value={trial.toLocaleString()} />
      <StatCard label="Revenue this month" value={rev(revenueMonth)} />
      <StatCard label="Revenue year to date" value={rev(revenueYear)} />
    </section>
    <Card className="beeline-card"><CardContent className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><CreditCard className="size-4" />Plans</h2>
        <Link href="/admin/payments" className="inline-flex items-center gap-1 text-sm font-medium text-primary">Payments, invoices and refunds <ArrowRight className="size-3.5" /></Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Plan</th><th className="py-2 pr-3 font-medium">Price</th><th className="py-2 pr-3 font-medium">Consultations</th><th className="py-2 pr-3 font-medium">Subscribers</th><th className="py-2 font-medium">Status</th>
          </tr></thead>
          <tbody>
            {plans.map((p) => <tr key={p.id} className="border-b last:border-0">
              <td className="py-2.5 pr-3 font-medium">{p.name}<span className="block font-mono text-xs text-muted-foreground">{p.code}</span></td>
              <td className="py-2.5 pr-3">{Number(p.monthlyPrice) === 0 ? "Free" : formatMoney(String(p.monthlyPrice), p.currency)}</td>
              <td className="py-2.5 pr-3">{p.consultationAllowance ?? "Unlimited"}</td>
              <td className="py-2.5 pr-3 tabular-nums">{p._count.subscriptions.toLocaleString()}</td>
              <td className="py-2.5"><Badge variant={p.active ? "default" : "secondary"}>{p.active ? "active" : "inactive"}</Badge></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {refundsOpen > 0 && <p className="text-sm text-warning">{refundsOpen} refund{refundsOpen === 1 ? "" : "s"} awaiting processing — <Link href="/admin/refunds" className="font-medium underline">review the refund queue</Link>.</p>}
      <p className="text-xs text-muted-foreground">The system never deletes clinical records merely because a subscription expires. Paid services may be suspended according to policy, while the clinical record remains intact and accessible to authorised professionals.</p>
    </CardContent></Card>
  </>;
}
