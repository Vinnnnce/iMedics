import Link from "next/link";
import { Calendar, ClipboardList, FlaskConical, Users, BadgeCheck, CreditCard, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { clinicInstant, clinicToday, daysAgo, monthStart } from "@/lib/clinic-time";
import { countPendingReview } from "@/lib/data/ai-review";
import { visibleToDoctor } from "@/lib/booking";
import { formatClinicDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { notFound } from "next/navigation";
import { NotificationsCard } from "@/components/shared/notifications-card";
import { listUnreadNotifications } from "@/lib/data/notifications";
import { loadWorkspace } from "@/lib/workspace/data";
import { DoctorCareSections } from "@/components/dashboard/doctor";
import { DoctorReviewsCard } from "@/components/doctor/reviews-card";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { greetingFor } from "@/lib/dashboard/greeting";
import { FAQS } from "@/lib/faqs";
import { FaqSection } from "@/components/shared/faq-section";
import { doctorSuggestions } from "@/lib/suggestions";
import { SuggestionsCard } from "@/components/shared/suggestions-card";

export default async function DoctorDashboardPage() {
  const user = await requirePageRole("DOCTOR");
  const workspace = await loadWorkspace(user);
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const today = clinicToday();
  const dayStart = clinicInstant(today, 0);
  const dayEnd = clinicInstant(today, 24 * 60);
  const monthAgoStart = monthStart();
  const weekStart = daysAgo(7);
  // Fetch payments once for the earliest period we display (month or rolling week).
  const earningsFetchSince = weekStart < monthAgoStart ? weekStart : monthAgoStart;

  const [pendingBookings, activePatients, consultationsToday, aiToReview, upcoming, notifications, reviews, recentPayments, urgentAlerts] = await Promise.all([
    prisma.appointment.count({ where: { AND: [{ doctorId: doctor.id, status: "BOOKED", scheduledAt: { gte: new Date() } }, visibleToDoctor] } }),
    prisma.patientAssignment.count({ where: { doctorId: doctor.id, status: "ACTIVE", patient: { deletedAt: null } } }),
    prisma.consultation.count({ where: { doctorId: doctor.id, createdAt: { gte: dayStart, lt: dayEnd } } }),
    countPendingReview(user),
    prisma.appointment.findMany({
      where: { AND: [{ doctorId: doctor.id, status: { in: ["BOOKED", "CONFIRMED"] }, scheduledAt: { gte: new Date() } }, visibleToDoctor] },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    }),
    listUnreadNotifications(user.id),
    prisma.doctorReview.findMany({
      where: { doctorId: doctor.id, moderationStatus: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, rating: true, comment: true, createdAt: true, doctorResponse: true, patient: { select: { firstName: true } } },
    }),
    // Successful payments paid to this doctor since the earliest displayed period
    prisma.payment.findMany({
      where: { payeeId: user.id, status: "SUCCESSFUL", paidAt: { gte: earningsFetchSince } },
      select: { amount: true, currency: true, paidAt: true },
    }),
    workspace.alerts.filter(item => item.tone === "red"),
  ]);

  const stats = [
    { label: "Booking requests", value: pendingBookings, icon: Calendar, href: "/doctor/booking-requests" },
    { label: "Active patients", value: activePatients, icon: Users, href: "/doctor/patients" },
    { label: "AI results to review", value: aiToReview, icon: FlaskConical, href: "/doctor/ai-tools" },
    { label: "Consultations today", value: consultationsToday, icon: ClipboardList, href: "/doctor/consultations" },
  ];

  // Gross earnings (before platform commission) grouped by currency.
  const earningsFor = (since: Date) => {
    const totals = new Map<string, number>();
    for (const payment of recentPayments) {
      if (payment.paidAt && payment.paidAt >= since) {
        totals.set(payment.currency, (totals.get(payment.currency) ?? 0) + Number(payment.amount));
      }
    }
    return [...totals.entries()].map(([currency, total]) => formatMoney(total, currency));
  };
  const earningsToday = earningsFor(dayStart);
  const earningsThisWeek = earningsFor(weekStart);
  const earningsThisMonth = earningsFor(monthAgoStart);
  const joinCurrencies = (totals: string[]) => (totals.length > 0 ? totals.join(" · ") : "—");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">{greetingFor()}, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your patients and consultations</p>
        </div>
        <Badge className="bg-muted text-muted-foreground rounded-lg ml-auto">
          <BadgeCheck className="h-3 w-3 mr-1" /> Verified
        </Badge>
      </div>

      <NotificationsCard items={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} />
      <DoctorReviewsCard
        initial={reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
          author: r.patient.firstName,
          doctorResponse: r.doctorResponse,
        }))}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="beeline-card h-full transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <stat.icon className="h-5 w-5 text-muted-foreground" />
                <p className="mt-3 text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Clinical workflow widgets: urgent information first, one clear primary action each */}
      <div className="grid gap-3 sm:grid-cols-2">
        <WidgetCard
          title="Next appointments"
          icon={Calendar}
          status={upcoming[0] ? { tone: "success", label: "Scheduled" } : { tone: "neutral", label: "None" }}
          action={{ href: "/doctor/consultations", label: "Start consultation" }}
        >
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {upcoming.slice(0, 3).map(appointment => (
                <li key={appointment.id} className="flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {appointment.patient.firstName} {appointment.patient.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatClinicDateTime(appointment.scheduledAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>

        <WidgetCard
          title="Urgent clinical alerts"
          icon={TrendingUp}
          status={urgentAlerts.length > 0 ? { tone: "danger", label: `${urgentAlerts.length} urgent` } : { tone: "success", label: "None" }}
          action={{ href: "#care-workspace", label: "Review" }}
        >
          {urgentAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No critical results or overdue follow-ups.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {urgentAlerts.slice(0, 3).map(alert => (
                <li key={alert.id} className="flex items-center justify-between gap-3">
                  <span className="font-medium">{alert.title}</span>
                  <span className="text-xs text-muted-foreground">{alert.status}</span>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>

        <WidgetCard
          title="Earnings"
          icon={CreditCard}
          status={{ tone: "success", label: "This month" }}
          action={{ href: "/payments", label: "View earnings" }}
        >
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Today</dt>
              <dd className="font-medium">{joinCurrencies(earningsToday)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Last 7 days</dt>
              <dd className="font-medium">{joinCurrencies(earningsThisWeek)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">This month</dt>
              <dd className="font-medium">{joinCurrencies(earningsThisMonth)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">Gross revenue before platform commission.</p>
        </WidgetCard>

        <WidgetCard
          title="Subscription"
          icon={CreditCard}
          status={
            workspace.subscription.toLowerCase().includes("active")
              ? { tone: "success", label: "Active" }
              : { tone: "warning", label: "Not active" }
          }
          action={{ href: "/doctor/subscription", label: "Manage plan" }}
        >
          <p className="text-sm">
            <span className="text-muted-foreground">Current plan: </span>
            <span className="font-medium">{workspace.subscription}</span>
          </p>
          <p className="text-xs text-muted-foreground">Feature access, including AI tools, depends on your plan.</p>
        </WidgetCard>
      </div>

      {/* Account-specific suggestions */}
      <SuggestionsCard
        items={doctorSuggestions({
          pendingBookings,
          aiToReview,
          subscriptionActive: workspace.subscription.toLowerCase().includes("active"),
          activePatients,
        })}
      />

      <DoctorCareSections data={workspace} />

      {/* Account-specific FAQ (shown only on the dashboard) */}
      <FaqSection items={FAQS.DOCTOR} className="" intro="Answers to questions doctors ask most." />
    </div>
  );
}