import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar, FileText, FlaskConical, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationsCard } from "@/components/shared/notifications-card";
import { getCurrentUser } from "@/lib/auth";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { listUnreadNotifications } from "@/lib/data/notifications";
import { formatClinicDateTime, formatDate } from "@/lib/format";

export default async function PatientDashboardPage() {
  // Other roles have their own dashboards; "/" already routes everyone correctly.
  const current = await getCurrentUser();
  if (current && current.role !== "PATIENT" && current.onboardingComplete) redirect("/");
  const user = await requirePageRole("PATIENT");

  const owner = { patient: { userId: user.id, deletedAt: null } };
  const [upcoming, activePrescriptions, resultCount, recentResults, notifications] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...owner, status: { in: ["BOOKED", "CONFIRMED"] }, scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 3,
      include: { doctor: { select: { user: { select: { name: true } } } } },
    }),
    prisma.prescription.count({ where: { ...owner, status: "ACTIVE" } }),
    prisma.labResult.count({ where: { ...owner, status: { not: "REJECTED" } } }),
    prisma.labResult.findMany({
      where: { ...owner, status: { not: "REJECTED" } },
      orderBy: { testDate: "desc" },
      take: 3,
      select: { id: true, panelType: true, testDate: true, status: true },
    }),
    listUnreadNotifications(user.id),
  ]);

  const stats = [
    { label: "Upcoming appointments", value: upcoming.length, icon: Calendar, href: "/patient/appointments" },
    { label: "Active prescriptions", value: activePrescriptions, icon: FileText, href: "/patient/prescriptions" },
    { label: "Lab results", value: resultCount, icon: FlaskConical, href: "/patient/results" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hello, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your health at a glance</p>
      </div>

      <NotificationsCard items={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} />

      <div className="grid grid-cols-3 gap-3">
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

      <Card className="beeline-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Next appointments</CardTitle>
          <Link href="/doctors" className="flex items-center gap-1 text-sm underline">
            <Stethoscope className="h-4 w-4" /> Find a doctor
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming appointments.</p>}
          {upcoming.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{a.doctor.user.name}</p>
                <p className="text-xs text-muted-foreground">{formatClinicDateTime(a.scheduledAt)}</p>
              </div>
              <Badge variant={a.status === "CONFIRMED" ? "secondary" : "outline"} className="rounded-lg">
                {a.status === "CONFIRMED" ? "Confirmed" : "Awaiting doctor"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Recent lab results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentResults.length === 0 && <p className="text-sm text-muted-foreground">No results yet.</p>}
          {recentResults.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <p className="font-medium">{r.panelType}</p>
              <p className="text-xs text-muted-foreground">{formatDate(r.testDate)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
