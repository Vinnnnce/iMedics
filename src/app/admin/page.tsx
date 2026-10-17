import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, PageHeader, StatCard, ago } from "@/components/admin/ui";
import { getOverview } from "@/lib/admin/overview";
import { describeAction } from "@/lib/admin/audit-labels";
import { formatMoney } from "@/lib/money";
import { formatClinicDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const o = await getOverview();
  const oldestDays = o.verifications.oldestPendingDays;

  const attention = [
    o.verifications.pending > 0 && {
      key: "verif", href: "/admin/verifications", tone: oldestDays >= 3 ? ("danger" as const) : ("warning" as const),
      title: `${o.verifications.pending} application${o.verifications.pending === 1 ? "" : "s"} awaiting review`,
      hint: o.verifications.oldestPending ? `Oldest has waited ${ago(o.verifications.oldestPending).replace(" ago", "")}` : "",
    },
    o.payments.stuckRefunds > 0 && { key: "refunds", href: "/admin/payments?status=REFUND_PENDING", tone: "danger" as const, title: `${o.payments.stuckRefunds} refund${o.payments.stuckRefunds === 1 ? "" : "s"} pending for over a day`, hint: "Check the payment gateway" },
    o.payments.failed7 > 0 && { key: "failed", href: "/admin/payments?status=FAILED", tone: "warning" as const, title: `${o.payments.failed7} failed payment${o.payments.failed7 === 1 ? "" : "s"} this week`, hint: "" },
    o.users.suspended + o.users.banned > 0 && { key: "restricted", href: "/admin/users?status=SUSPENDED", tone: "warning" as const, title: `${o.users.suspended + o.users.banned} restricted account${o.users.suspended + o.users.banned === 1 ? "" : "s"}`, hint: `${o.users.suspended} suspended, ${o.users.banned} banned` },
  ].filter(Boolean) as { key: string; href: string; tone: "warning" | "danger"; title: string; hint: string }[];

  const paymentLabels: [string, string][] = [["SUCCESSFUL", "Successful"], ["PENDING", "Awaiting payment"], ["FAILED", "Failed"], ["REFUND_PENDING", "Refund in progress"], ["REFUNDED", "Refunded"], ["CANCELLED", "Cancelled"]];
  const paymentTotal = Object.values(o.payments.byStatus).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Overview" description={`Platform status as of ${formatClinicDateTime(new Date())}`} />

      <section aria-label="Needs attention" className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Needs attention</h2>
        {attention.length === 0 ? (
          <Card className="beeline-card">
            <CardContent className="flex items-center gap-2 p-4 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" /> Nothing needs your attention right now.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {attention.map((a) => (
              <Link key={a.key} href={a.href}>
                <Card className={`beeline-card transition-colors hover:bg-muted/40 ${a.tone === "danger" ? "border-destructive/50" : "border-warning/50"}`}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <AlertTriangle className={`h-5 w-5 shrink-0 ${a.tone === "danger" ? "text-destructive" : "text-warning"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{a.title}</p>
                      {a.hint && <p className="text-xs text-muted-foreground">{a.hint}</p>}
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Users" value={o.users.total.toLocaleString()} hint={`+${o.users.new7} this week · +${o.users.new30} in 30 days`} href="/admin/users" />
        <StatCard label="Doctors" value={o.users.doctors.toLocaleString()} hint={`${o.verifications.pendingDoctors} awaiting review`} href="/admin/users?role=DOCTOR" />
        <StatCard label="Facilities" value={o.users.facilities.toLocaleString()} hint={`${o.verifications.pendingFacilities} awaiting review`} href="/admin/users?role=LAB_SCIENTIST" />
        <StatCard label="Patients" value={o.users.patients.toLocaleString()} href="/admin/users?role=PATIENT" />
        <StatCard label="Appointments today" value={o.appointments.today} hint={`${o.appointments.next7} in the next 7 days`} />
        <StatCard label="Awaiting doctor" value={o.appointments.awaitingDoctor} hint="Paid, not yet confirmed" />
        <StatCard label="Consultations" value={o.clinical.consultations.toLocaleString()} hint={`${o.clinical.finalizedConsultations} finalised`} />
        <StatCard
          label="Payments, last 30 days"
          value={o.payments.volume30.length === 0 ? "—" : o.payments.volume30.map((v) => formatMoney(v.amount, v.currency)).join(" · ")}
          hint={`${o.payments.volume30.reduce((a, v) => a + v.count, 0)} successful`}
          href="/admin/payments"
        />
      </section>

      <section aria-label="Trends" className="grid gap-4 lg:grid-cols-3">
        <Card className="beeline-card"><CardContent className="p-4"><BarChart data={o.series.registrations} label="New registrations" /></CardContent></Card>
        <Card className="beeline-card"><CardContent className="p-4"><BarChart data={o.series.appointments} label="Appointments booked" /></CardContent></Card>
        <Card className="beeline-card"><CardContent className="p-4"><BarChart data={o.series.payments} label="Payments received" /></CardContent></Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="beeline-card">
          <CardHeader><CardTitle className="text-base">Payments by status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {paymentTotal === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
            {paymentLabels.filter(([k]) => o.payments.byStatus[k]).map(([k, label]) => {
              const n = o.payments.byStatus[k];
              return (
                <Link key={k} href={`/admin/payments?status=${k}`} className="block space-y-1">
                  <div className="flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-muted-foreground">{n}</span></div>
                  <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-foreground" style={{ width: `${Math.max(2, (n / paymentTotal) * 100)}%` }} /></div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card className="beeline-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent administrator activity</CardTitle>
            <Link href="/admin/activity?group=admin" className="text-xs underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {o.recentActivity.length === 0 && <p className="text-sm text-muted-foreground">No administrator actions recorded yet.</p>}
            {o.recentActivity.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{describeAction(a.action)}</p>
                  <p className="text-xs text-muted-foreground">{a.user?.name ?? "System"}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{ago(a.createdAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
