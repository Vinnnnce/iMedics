import Link from "next/link";
import {
  Calendar, ClipboardList, FlaskConical, Users, Sparkles, MessageSquare, Building2, BadgeCheck,
  Bell, FileText, Stethoscope, ClipboardCheck,
} from "lucide-react";
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
import { ProfileCompletenessCard } from "@/components/shared/profile-completeness-card";
import { doctorCompleteness } from "@/lib/profile-completeness";

export default async function DoctorDashboardPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const today = clinicToday();
  const dayStart = clinicInstant(today, 0);
  const dayEnd = clinicInstant(today, 24 * 60);

  const [
    pendingBookings, activePatients, consultationsToday, aiToReview, upcoming, notifications,
    workspace, scheduleCount, portfolioCount,
    todaysAppointments, recentConsultations, draftConsultations, openCriticalAlerts, followUps,
    recentLabResults, recentPrescriptions,
  ] = await Promise.all([
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
    prisma.doctorSchedule.count({ where: { doctorId: doctor.id } }),
    prisma.doctorPortfolioItem.count({ where: { doctorId: doctor.id } }),
    // Today's schedule — booked or confirmed appointments later today.
    prisma.appointment.findMany({
      where: { AND: [{ doctorId: doctor.id, status: { in: ["BOOKED", "CONFIRMED"] }, scheduledAt: { gte: dayStart, lt: dayEnd } }, visibleToDoctor] },
      orderBy: { scheduledAt: "asc" },
      take: 6,
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    }),
    // Recent consultations for the doctor's record overview.
    prisma.consultation.findMany({
      where: { doctorId: doctor.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    }),
    // Draft consultations still awaiting the doctor's finalisation.
    prisma.consultation.count({ where: { doctorId: doctor.id, status: "DRAFT" } }),
    // Critical result alerts sent to this doctor and not yet acknowledged.
    prisma.criticalResultAlert.count({
      where: { notifiedUserId: user.id, status: { in: ["SENT", "ESCALATED"] } },
    }),
    // Follow-ups: consultations whose recorded follow-up date is due or overdue.
    prisma.consultation.findMany({
      where: { doctorId: doctor.id, followUpDate: { lte: dayEnd, not: null } },
      orderBy: { followUpDate: "asc" },
      take: 5,
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    }),
    // Recent patient activity: newest results for this doctor's assigned patients.
    prisma.labResult.findMany({
      where: { patient: { deletedAt: null, assignments: { some: { doctorId: doctor.id, status: "ACTIVE" } } } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    }),
    // Recent prescriptions issued by this doctor.
    prisma.prescription.findMany({
      where: { doctorId: doctor.id },
      orderBy: { issuedAt: "desc" },
      take: 5,
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ]);

  const completeness = doctorCompleteness({
    avatarUrl: user.avatarUrl,
    specialty: doctor.specialty,
    biography: doctor.biography,
    education: doctor.education,
    languages: doctor.languages,
    location: doctor.location,
    consultationFee: doctor.consultationFee,
    scheduleCount,
    portfolioCount,
  });

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

  // Pending clinical tasks: everything that waits on the doctor's action.
  const clinicalTasks = [
    { label: "Draft consultations to finalise", value: draftConsultations, href: "/doctor/consultations", icon: ClipboardCheck },
    { label: "Critical alerts to acknowledge", value: openCriticalAlerts, href: "/doctor/lab-requests", icon: Bell },
    { label: "AI analyses to review", value: aiToReview, href: "/doctor/ai-tools", icon: Sparkles },
  ].filter((t) => t.value > 0);

  // Recent patient activity feed, newest first.
  const activityFeed = [
    ...recentLabResults.map((r) => ({
      key: `lab-${r.id}`,
      at: r.createdAt,
      patient: `${r.patient.firstName} ${r.patient.lastName}`,
      text: r.interpretation ? `Lab result uploaded — ${r.interpretation}` : `Lab result uploaded (${r.panelType})`,
      icon: FlaskConical,
      href: "/doctor/lab-requests",
    })),
    ...recentPrescriptions.map((p) => ({
      key: `rx-${p.id}`,
      at: p.issuedAt,
      patient: `${p.patient.firstName} ${p.patient.lastName}`,
      text: "Prescription issued",
      icon: FileText,
      href: "/doctor/prescriptions",
    })),
    ...recentConsultations.map((c) => ({
      key: `consult-${c.id}`,
      at: c.createdAt,
      patient: `${c.patient.firstName} ${c.patient.lastName}`,
      text: c.status === "DRAFT" ? "Consultation drafted" : "Consultation completed",
      icon: Stethoscope,
      href: "/doctor/consultations",
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 6);

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

      <ProfileCompletenessCard completeness={completeness} title="Complete your public profile" />

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

      {/* Pending clinical tasks — the doctor's actionable queue */}
      {clinicalTasks.length > 0 && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Pending clinical tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {clinicalTasks.map((task) => (
              <Link key={task.label} href={task.href} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/50">
                <span className="flex items-center gap-3">
                  <task.icon className="h-4 w-4 text-muted-foreground" />
                  {task.label}
                </span>
                <Badge className="rounded-lg">{task.value}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's appointments */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Today&#39;s appointments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {todaysAppointments.length === 0 && <p className="text-sm text-muted-foreground">No appointments scheduled for today.</p>}
          {todaysAppointments.map((a) => (
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

      {/* Upcoming appointments */}
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

      <div className="grid gap-3 md:grid-cols-2">
        {/* Follow-up patients */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Follow-up patients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {followUps.length === 0 && <p className="text-sm text-muted-foreground">No follow-ups due.</p>}
            {followUps.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">
                    {c.patient.firstName} {c.patient.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Follow-up {c.followUpDate ? formatClinicDateTime(c.followUpDate) : ""}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-lg">{c.status === "DRAFT" ? "Draft" : "Finalised"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent consultations */}
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Recent consultations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentConsultations.length === 0 && <p className="text-sm text-muted-foreground">No consultations yet.</p>}
            {recentConsultations.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">
                    {c.patient.firstName} {c.patient.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatClinicDateTime(c.createdAt)}</p>
                </div>
                <Badge variant={c.status === "FINALIZED" ? "secondary" : "outline"} className="rounded-lg">
                  {c.status === "FINALIZED" ? "Finalised" : "Draft"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent patient activity */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Recent patient activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {activityFeed.length === 0 && <p className="text-sm text-muted-foreground">No recent activity for your patients.</p>}
          {activityFeed.map((item) => (
            <Link key={item.key} href={item.href} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/50">
              <span className="flex min-w-0 items-center gap-3">
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="font-medium">{item.patient}</span>
                  <span className="text-muted-foreground"> — {item.text}</span>
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatClinicDateTime(item.at)}</span>
            </Link>
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
