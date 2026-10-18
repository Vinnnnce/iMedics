import Link from "next/link";
import { Calendar, ClipboardList, FlaskConical, Users, Sparkles, MessageSquare, Building2, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { clinicInstant, clinicToday } from "@/lib/clinic-time";
import { countPendingReview } from "@/lib/data/ai-review";
import { visibleToDoctor } from "@/lib/booking";
import { formatClinicDateTime } from "@/lib/format";
import { notFound } from "next/navigation";
import { NotificationsCard } from "@/components/shared/notifications-card";
import { SuggestionsCard } from "@/components/shared/suggestions-card";
import { doctorSuggestions } from "@/lib/suggestions";
import { loadWorkspace } from "@/lib/workspace/data";
import { listUnreadNotifications } from "@/lib/data/notifications";

export default async function DoctorDashboardPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const today = clinicToday();
  const dayStart = clinicInstant(today, 0);
  const dayEnd = clinicInstant(today, 24 * 60);

  const [pendingBookings, activePatients, consultationsToday, aiToReview, upcoming, notifications, workspace] = await Promise.all([
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
    loadWorkspace(user),
  ]);

  const suggestionItems = doctorSuggestions({
    pendingBookings,
    activePatients,
    aiToReview,
    subscriptionActive: workspace.subscription.toLowerCase().includes("active"),
  });

  const stats = [
    { label: "Booking requests", value: pendingBookings, icon: Calendar, href: "/doctor/booking-requests" },
    { label: "Active patients", value: activePatients, icon: Users, href: "/doctor/patients" },
    { label: "AI results to review", value: aiToReview, icon: FlaskConical, href: "/doctor/ai-tools" },
    { label: "Consultations today", value: consultationsToday, icon: ClipboardList, href: "/doctor/consultations" },
  ];

  const modules = [
    { href: "/doctor/patients", label: "My patients", desc: "Search patient records and history", icon: Users },
    { href: "/doctor/consultations", label: "Write consultation", desc: "Create consultation reports", icon: ClipboardList },
    { href: "/doctor/schedule", label: "Schedule", desc: "Publish your availability", icon: Calendar },
    { href: "/doctor/ai-tools", label: "AI review", desc: "Approve or reject AI summaries", icon: Sparkles },
    { href: "/doctor/chat", label: "Patient chat", desc: "Message your patients", icon: MessageSquare },
    { href: "/doctor/admit", label: "Care roster", desc: "Discharge or re-admit patients", icon: Building2 },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Doctor Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your patients and consultations</p>
        </div>
        <Badge className="bg-muted text-muted-foreground rounded-lg ml-auto">
          <BadgeCheck className="h-3 w-3 mr-1" /> Verified
        </Badge>
      </div>

      <NotificationsCard items={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} />

      {/* Account-specific suggestions */}
      <SuggestionsCard items={suggestionItems} />

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

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Upcoming appointments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming appointments.</p>}
          {upcoming.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">
                  {a.patient.firstName} {a.patient.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{formatClinicDateTime(a.scheduledAt)}</p>
              </div>
              <Badge variant={a.status === "CONFIRMED" ? "secondary" : "outline"} className="rounded-lg">
                {a.status === "CONFIRMED" ? "Confirmed" : "Awaiting your reply"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card className="beeline-card h-full transition-colors hover:bg-muted/50">
              <CardContent className="flex items-start gap-3 p-4">
                <m.icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
