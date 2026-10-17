import Link from "next/link";
import { Calendar, FlaskConical, Upload, Tags, Wallet, Users, Inbox, AlertTriangle, Activity, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireFacilityPortalPage } from "@/lib/guards";
import { clinicInstant, clinicToday, monthStart, daysAgo, daysFromNow } from "@/lib/clinic-time";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { loadWorkspace } from "@/lib/workspace/data";
import { formatMoney } from "@/lib/money";
import { greetingFor } from "@/lib/dashboard/greeting";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { FacilitySections } from "@/components/dashboard/facility";
import { credentialExpiryState } from "@/lib/facility-staff";
import { ACTIVE_WORKFLOW_STAGES } from "@/lib/facility-workflow";
import { facilityFaqs } from "@/lib/faqs";
import { FaqSection } from "@/components/shared/faq-section";

export default async function LabDashboardPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);
  const workspace = await loadWorkspace(user);
  const today = clinicToday();
  const dayStart = clinicInstant(today, 0);
  const dayEnd = clinicInstant(today, 24 * 60);
  const weekStartAt = daysAgo(7);
  const monthAgoStart = monthStart();
  const in90Days = daysFromNow(90);

  const [
    bookingsToday,
    unconfirmedBookings,
    pendingWorkflow,
    staffCounts,
    referralInbox,
    expiringCredentials,
    cancelledThisMonth,
    releasedThisMonth,
    pendingResultUploads,
    activeServices,
  ] = await Promise.all([
    // Bookings scheduled for today (visits, not record creation time)
    prisma.facilityBooking.count({
      where: { service: { facilityId: profile.id }, preferredAt: { gte: dayStart, lt: dayEnd }, status: { in: ["REQUESTED", "CONFIRMED"] } },
    }),
    // Bookings awaiting confirmation
    prisma.facilityBooking.count({
      where: { service: { facilityId: profile.id }, status: "REQUESTED", OR: [{ payment: null }, { payment: { status: { in: ["SUCCESSFUL", "REFUND_PENDING", "REFUNDED"] } } }] },
    }),
    // Bookings inside the operational workflow (result queue)
    prisma.facilityBooking.count({
      where: { service: { facilityId: profile.id }, workflowStage: { in: ACTIVE_WORKFLOW_STAGES }, status: { notIn: ["CANCELLED"] } },
    }),
    // Staff status
    prisma.facilityStaff.groupBy({ by: ["status"], where: { facilityId: profile.id }, _count: { _all: true } }),
    // Referral inbox
    prisma.facilityReferral.count({ where: { facilityId: profile.id, status: "PENDING" } }),
    // Credential alerts: expiring within 90 days or already expired
    prisma.staffCredential.findMany({
      where: { staff: { facilityId: profile.id }, expiryDate: { lte: in90Days } },
      select: { expiryDate: true },
    }),
    prisma.facilityBooking.count({
      where: { service: { facilityId: profile.id }, status: "CANCELLED", updatedAt: { gte: monthAgoStart } },
    }),
    // Released bookings this month (for turnaround)
    prisma.facilityBooking.findMany({
      where: { service: { facilityId: profile.id }, releasedAt: { gte: monthAgoStart } },
      select: { createdAt: true, releasedAt: true },
      take: 200,
    }),
    // Uploaded lab results awaiting verification/release (doctor-ordered flow)
    prisma.labResult.count({ where: { uploadedById: user.id, status: "PENDING" } }),
    prisma.facilityService.count({ where: { facilityId: profile.id, isActive: true } }),
  ]);

  // Revenue (facility-service charges only, with commission split), per period.
  const [revenueToday, revenueWeek, revenueMonth] = await Promise.all(
    (["today", "week", "month"] as const).map(async (period) => {
      const since = period === "today" ? dayStart : period === "week" ? weekStartAt : monthAgoStart;
      const rows = await prisma.payment.findMany({
        where: { kind: "FACILITY_SERVICE", status: "SUCCESSFUL", paidAt: { gte: since }, facilityBooking: { service: { facilityId: profile.id } } },
        select: { amount: true, commissionAmount: true, netAmount: true, currency: true },
      });
      const totals = new Map<string, { gross: number; commission: number; net: number }>();
      for (const row of rows) {
        const t = totals.get(row.currency) ?? { gross: 0, commission: 0, net: 0 };
        t.gross += Number(row.amount);
        t.commission += Number(row.commissionAmount ?? 0);
        t.net += Number(row.netAmount ?? 0);
        totals.set(row.currency, t);
      }
      return totals;
    }),
  );

  const sumLabel = (totals: Map<string, { gross: number; commission: number; net: number }>) => {
    const parts: string[] = [];
    for (const [currency, t] of totals) {
      if (t.gross <= 0) continue;
      parts.push(`${formatMoney(t.gross, currency)} gross · ${formatMoney(t.commission, currency)} commission · ${formatMoney(t.net, currency)} net`);
    }
    return parts.join(" · ");
  };

  const staffActive = staffCounts.find((c) => c.status === "ACTIVE")?._count._all ?? 0;
  const staffOnLeave = staffCounts.find((c) => c.status === "ON_LEAVE")?._count._all ?? 0;
  const staffInvited = staffCounts.find((c) => c.status === "INVITED")?._count._all ?? 0;

  const expiringSoon = expiringCredentials.filter((c) => credentialExpiryState(c) === "EXPIRING_SOON").length;
  const expired = expiringCredentials.filter((c) => credentialExpiryState(c) === "EXPIRED").length;

  // Average turnaround (hours) from booking creation to release, this month.
  const turnaroundHours = releasedThisMonth.length
    ? Math.round(
        (releasedThisMonth.reduce((acc, r) => acc + ((r.releasedAt?.getTime() ?? 0) - r.createdAt.getTime()), 0) /
          releasedThisMonth.length) / 3_600_000,
      )
    : null;

  const monthRevenue = sumLabel(revenueMonth);

  const quickStats = [
    { label: "Bookings today", value: bookingsToday, icon: Calendar, href: "/lab/bookings" },
    { label: "In workflow", value: pendingWorkflow, icon: FlaskConical, href: "/lab/bookings" },
    { label: "Results pending", value: pendingResultUploads, icon: Upload, href: "/lab/orders" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{greetingFor()}, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile.laboratoryName ?? "Facility"} dashboard — bookings, results, staff, and revenue at a glance
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-3">
        {quickStats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="beeline-card h-full transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <s.icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                <p className="mt-3 text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* 1. Today's activity */}
        <WidgetCard
          title="Today's activity"
          icon={Activity}
          status={bookingsToday > 0 ? { tone: "warning", label: `${bookingsToday} today` } : { tone: "neutral", label: "None today" }}
          action={{ href: "/lab/bookings", label: "View schedule" }}
        >
          <p className="text-sm text-muted-foreground">
            {bookingsToday > 0
              ? `${bookingsToday} ${bookingsToday === 1 ? "booking is" : "bookings are"} scheduled for today.`
              : "No bookings scheduled for today yet. Published services and prices drive bookings."}
          </p>
        </WidgetCard>

        {/* 2. Pending tasks */}
        <WidgetCard
          title="Pending tasks"
          icon={ListChecks}
          status={unconfirmedBookings > 0 ? { tone: "warning", label: `${unconfirmedBookings} unconfirmed` } : { tone: "success", label: "All confirmed" }}
          action={{ href: "/lab/bookings", label: "Open queue" }}
        >
          <p className="text-sm text-muted-foreground">
            {unconfirmedBookings > 0
              ? `${unconfirmedBookings} ${unconfirmedBookings === 1 ? "booking needs" : "bookings need"} confirmation.`
              : "No unconfirmed bookings. "}
            {pendingResultUploads > 0 ? `${pendingResultUploads} uploaded ${pendingResultUploads === 1 ? "result awaits" : "results await"} verification.` : ""}
          </p>
        </WidgetCard>

        {/* 3. Staff status */}
        <WidgetCard
          title="Staff"
          icon={Users}
          status={{ tone: staffActive > 0 ? "success" : "neutral", label: `${staffActive} active` }}
          action={{ href: "/lab/staff", label: "Manage staff" }}
        >
          <p className="text-sm text-muted-foreground">
            {staffActive} active · {staffOnLeave} on leave · {staffInvited} invited. Every staff member signs in with their own account.
          </p>
        </WidgetCard>

        {/* 4. Revenue with commission split */}
        <WidgetCard
          title="Revenue this month"
          icon={Wallet}
          status={monthRevenue ? { tone: "success", label: "Paid" } : { tone: "neutral", label: "No payments" }}
          action={{ href: "/payments", label: "View earnings" }}
        >
          <p className="text-sm text-muted-foreground">
            {monthRevenue
              ? `${monthRevenue}. Medic1905 receives only its commission.`
              : "No payments received this month yet. Earnings appear once patients book and pay for your services."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Today: {sumLabel(revenueToday) || "—"} · This week: {sumLabel(revenueWeek) || "—"}
          </p>
        </WidgetCard>

        {/* 5. Result queue */}
        <WidgetCard
          title="Result queue"
          icon={FlaskConical}
          status={pendingWorkflow > 0 ? { tone: "warning", label: `${pendingWorkflow} in progress` } : { tone: "success", label: "Queue clear" }}
          action={{ href: "/lab/bookings", label: "Update status" }}
        >
          <p className="text-sm text-muted-foreground">
            {pendingWorkflow > 0
              ? `${pendingWorkflow} ${pendingWorkflow === 1 ? "booking is" : "bookings are"} moving through check-in, sample, result and release stages.`
              : "No bookings are waiting in the sample/result workflow."}
          </p>
        </WidgetCard>

        {/* 6. Referral inbox */}
        <WidgetCard
          title="Referral inbox"
          icon={Inbox}
          status={referralInbox > 0 ? { tone: "warning", label: `${referralInbox} new` } : { tone: "neutral", label: "Empty" }}
          action={{ href: "/lab/referrals", label: "Review referrals" }}
        >
          <p className="text-sm text-muted-foreground">
            {referralInbox > 0
              ? `${referralInbox} ${referralInbox === 1 ? "referral is" : "referrals are"} waiting from Medic1905 doctors.`
              : "No new referrals from Medic1905 doctors."}
          </p>
        </WidgetCard>

        {/* 7. Service performance */}
        <WidgetCard
          title="Service performance"
          icon={Tags}
          status={{ tone: "neutral", label: `${activeServices} published` }}
          action={{ href: "/lab/services", label: "View analytics" }}
        >
          <p className="text-sm text-muted-foreground">
            {turnaroundHours !== null
              ? `Average time from booking to release this month: ${turnaroundHours} h. `
              : "No released bookings this month yet. "}
            {cancelledThisMonth} {cancelledThisMonth === 1 ? "cancellation" : "cancellations"} this month.
          </p>
        </WidgetCard>

        {/* 8. Alerts */}
        <WidgetCard
          title="Alerts"
          icon={AlertTriangle}
          status={expiringSoon + expired > 0 ? { tone: "warning", label: `${expiringSoon + expired} credential alerts` } : { tone: "success", label: "All clear" }}
          action={{ href: "/lab/credentials", label: "Resolve" }}
        >
          <p className="text-sm text-muted-foreground">
            {expiringSoon + expired > 0
              ? `${expiringSoon} ${expiringSoon === 1 ? "credential expires" : "credentials expire"} soon and ${expired} ${expired === 1 ? "has" : "have"} expired. Renewal reminders are sent at 90, 60, 30 and 7 days.`
              : "No credential alerts. Renewal reminders start 90 days before expiry."}
          </p>
        </WidgetCard>
      </div>

      <FacilitySections data={workspace} />

      {/* Account-specific FAQ (shown only on the dashboard) */}
      <FaqSection
        items={facilityFaqs(user.accountType)}
        className=""
        intro="Answers to questions facilities like yours ask most."
      />
    </div>
  );
}
