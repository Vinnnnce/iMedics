import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { StatusChip } from "@/components/shared/status-chip";
import { formatMoney } from "@/lib/money";

import { daysAgo } from "@/lib/clinic-time";

export default async function DoctorAnalyticsPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const ninetyDaysAgo = daysAgo(90);
  const thirtyDaysAgo = daysAgo(30);

  const [consultationsFinalized, consultationsLast30, appointments, reviews, payments] = await Promise.all([
    prisma.consultation.count({ where: { doctorId: doctor.id, status: "FINALIZED" } }),
    prisma.consultation.count({ where: { doctorId: doctor.id, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { doctorId: doctor.id, createdAt: { gte: ninetyDaysAgo } },
      _count: { _all: true },
    }),
    prisma.doctorReview.aggregate({
      where: { doctorId: doctor.id, moderationStatus: "APPROVED" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ["currency"],
      where: { payeeId: user.id, status: "SUCCESSFUL" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const statusCount = (status: string) =>
    appointments.find(group => group.status === status)?._count._all ?? 0;
  const completed = statusCount("COMPLETED");
  const noShows = statusCount("NO_SHOW");
  const cancelled = statusCount("CANCELLED");
  const totalRated = completed + noShows + cancelled || 1;
  const noShowRate = Math.round((noShows / totalRated) * 100);
  const averageRating = reviews._avg.rating;

  const stats = [
    { label: "Consultations completed (all time)", value: consultationsFinalized },
    { label: "Consultations created (last 30 days)", value: consultationsLast30 },
    { label: "No-show rate (last 90 days)", value: `${noShowRate}%` },
    {
      label: "Average rating",
      value: averageRating ? `${averageRating.toFixed(1)} / 5` : "No ratings yet",
    },
    { label: "Approved reviews", value: reviews._count._all },
    { label: "Appointments completed (last 90 days)", value: completed },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your practice performance at a glance</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {stats.map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appointments (last 90 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            <li className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>Completed</span>
              <StatusChip tone="success">{completed}</StatusChip>
            </li>
            <li className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>No-shows</span>
              <StatusChip tone="danger">{noShows}</StatusChip>
            </li>
            <li className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>Cancelled</span>
              <StatusChip tone="neutral">{cancelled}</StatusChip>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Appointment records older than 90 days are excluded to keep this view focused on current practice.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gross revenue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {payments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No successful payments recorded yet. Earnings appear here once patients start booking consultations.
            </p>
          )}
          <ul className="divide-y divide-border">
            {payments.map(group => (
              <li key={group.currency} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {group._count._all} successful {group._count._all === 1 ? "payment" : "payments"}
                </span>
                <span className="font-medium">
                  {group._sum.amount ? formatMoney(Number(group._sum.amount), group.currency) : "—"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Gross amounts before platform commission. Net payouts and commission reporting are shown on the
            payments page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}