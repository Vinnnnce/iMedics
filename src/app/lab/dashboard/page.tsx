import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar, ClipboardList, FlaskConical, Upload, Tags, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { clinicInstant, clinicToday, monthStart } from "@/lib/clinic-time";
import { facilityPatientWhere } from "@/lib/facility-access";
import { loadWorkspace } from "@/lib/workspace/data";
import { formatMoney } from "@/lib/money";
import { greetingFor } from "@/lib/dashboard/greeting";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { FacilitySections } from "@/components/dashboard/facility";

export default async function LabDashboardPage() {
  const user = await requirePageRole("LAB_SCIENTIST");
  const profile = await prisma.labStaffProfile.findUnique({ where: { userId: user.id } });
  if (!profile) redirect("/");
  const patient = await facilityPatientWhere(user);
  const workspace = await loadWorkspace(user);
  const today = clinicToday();
  const dayStart = clinicInstant(today, 0);
  const dayEnd = clinicInstant(today, 24 * 60);
  const monthAgoStart = monthStart();

  const [newOrders, inProgress, submittedToday, bookingsToday, pendingUploads, activeServices, revenuePayments] = await Promise.all([
    prisma.labOrder.count({ where: { patient, status: "ORDERED" } }),
    prisma.labOrder.count({ where: { patient, status: "IN_PROGRESS" } }),
    prisma.labResult.count({ where: { uploadedById: user.id, createdAt: { gte: dayStart, lt: dayEnd } } }),
    // Bookings scheduled for today (visits, not record creation time)
    prisma.facilityBooking.count({ where: { service: { facilityId: profile.id }, preferredAt: { gte: dayStart, lt: dayEnd }, status: { in: ["REQUESTED", "CONFIRMED"] } } }),
    prisma.labResult.count({ where: { uploadedById: user.id, status: "PENDING" } }),
    prisma.facilityService.count({ where: { facilityId: profile.id } }),
    prisma.payment.groupBy({
      by: ["currency"],
      where: { payeeId: user.id, status: "SUCCESSFUL", paidAt: { gte: monthAgoStart } },
      _sum: { amount: true },
    }),
  ]);

  const revenue = revenuePayments
    .map(group => (group._sum.amount ? formatMoney(Number(group._sum.amount), group.currency) : null))
    .filter(Boolean)
    .join(" · ");

  const stats = [
    { label: "New orders", value: newOrders, icon: ClipboardList, href: "/lab/orders" },
    { label: "In progress", value: inProgress, icon: FlaskConical, href: "/lab/orders" },
    { label: "Submitted today", value: submittedToday, icon: Upload, href: "/lab/upload" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{greetingFor()}, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Facility dashboard — orders, results, and revenue at a glance</p>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="beeline-card h-full transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <s.icon className="h-5 w-5 text-muted-foreground" />
                <p className="mt-3 text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Operational widgets: time-sensitive work first, one clear primary action each */}
      <div className="grid gap-3 sm:grid-cols-2">
        <WidgetCard
          title="Today's bookings"
          icon={Calendar}
          status={bookingsToday > 0 ? { tone: "warning", label: `${bookingsToday} today` } : { tone: "neutral", label: "None today" }}
          action={{ href: "/lab/bookings", label: "Manage schedule" }}
        >
          <p className="text-sm text-muted-foreground">
            {bookingsToday > 0
              ? `${bookingsToday} ${bookingsToday === 1 ? "booking was" : "bookings were"} received today for your services.`
              : "No new bookings today yet. Published services and prices drive bookings."}
          </p>
        </WidgetCard>

        <WidgetCard
          title="Pending results"
          icon={FlaskConical}
          status={pendingUploads > 0 ? { tone: "warning", label: `${pendingUploads} pending` } : { tone: "success", label: "None pending" }}
          action={{ href: "/lab/orders", label: "Update status" }}
        >
          <p className="text-sm text-muted-foreground">
            {pendingUploads > 0
              ? `${pendingUploads} uploaded ${pendingUploads === 1 ? "result is" : "results are"} awaiting verification and release.`
              : "All uploaded results have been released for doctor verification."}
          </p>
        </WidgetCard>

        <WidgetCard
          title="Service catalogue"
          icon={Tags}
          status={activeServices > 0 ? { tone: "success", label: `${activeServices} published` } : { tone: "warning", label: "Empty" }}
          action={{ href: "/lab/services", label: "Manage services" }}
        >
          <p className="text-sm text-muted-foreground">
            {activeServices > 0
              ? `${activeServices} ${activeServices === 1 ? "service is" : "services are"} published with prices and availability.`
              : "No services published yet. Publish your tests, scans, and procedures so patients can book them."}
          </p>
        </WidgetCard>

        <WidgetCard
          title="Revenue this month"
          icon={Wallet}
          status={revenue ? { tone: "success", label: "Paid" } : { tone: "neutral", label: "No payments" }}
          action={{ href: "/payments", label: "View earnings" }}
        >
          <p className="text-sm text-muted-foreground">
            {revenue
              ? `${revenue} received this month.`
              : "No payments received this month yet. Earnings appear once patients book and pay for your services."}
          </p>
        </WidgetCard>
      </div>

      <FacilitySections data={workspace} />
    </div>
  );
}