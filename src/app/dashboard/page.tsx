import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Activity, Calendar, FlaskConical, HeartPulse, MessageSquare, Pill, Receipt, Search,
  Stethoscope, Upload,
} from "lucide-react";
import { requirePageRole, getPatientProfile } from "@/lib/guards";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { daysAgo } from "@/lib/clinic-time";
import { loadWorkspace } from "@/lib/workspace/data";
import { NotificationsCard } from "@/components/shared/notifications-card";
import { listUnreadNotifications } from "@/lib/data/notifications";
import { formatClinicDateTime } from "@/lib/format";
import { greetingFor } from "@/lib/dashboard/greeting";
import { EmergencyButton } from "@/components/dashboard/emergency-button";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { PatientCareSections } from "@/components/dashboard/patient";

const primaryActions = [
  { href: "/doctors", label: "Book consultation", icon: Stethoscope },
  { href: "/patient/case-file", label: "Upload document", icon: Upload },
  { href: "/facilities", label: "Find laboratory", icon: FlaskConical },
  { href: "/patient/consult", label: "Message doctor", icon: MessageSquare },
];

export default async function DashboardPage() {
  // Other roles have their own dashboards; "/" already routes everyone correctly.
  const current = await getCurrentUser();
  if (current && current.role !== "PATIENT" && current.onboardingComplete) redirect("/");
  const user = await requirePageRole("PATIENT");
  const patient = await getPatientProfile(user.id);
  if (!patient) notFound();
  const workspace = await loadWorkspace(user);

  const weekAgo = daysAgo(7);
  const [notifications, nextAppointment, pendingResults, newResults, unreadMessages, unpaidPayments, failedPayments, activePrescriptions, medicalHistory] = await Promise.all([
    listUnreadNotifications(user.id),
    // Next upcoming appointment with doctor details
    prisma.appointment.findFirst({
      where: { patientId: patient.id, status: { in: ["BOOKED", "CONFIRMED"] }, scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      include: { doctor: { select: { specialty: true, user: { select: { name: true } } } } },
    }),
    // Results still being processed or awaiting release
    prisma.labResult.count({
      where: { patientId: patient.id, status: { notIn: ["VERIFIED", "REJECTED"] } },
    }),
    // Results released in the last 7 days
    prisma.labResult.count({
      where: { patientId: patient.id, status: "VERIFIED", verifiedAt: { gte: weekAgo } },
    }),
    // Unread messages from doctors and facilities
    prisma.chatMessage.count({
      where: { conversation: { patientId: patient.id }, senderId: { not: user.id }, readAt: null },
    }),
    // Payments that still need attention (unpaid bookings vs failed payments)
    prisma.payment.count({
      where: { payerId: user.id, status: "PENDING" },
    }),
    prisma.payment.count({
      where: { payerId: user.id, status: "FAILED" },
    }),
    prisma.prescription.count({
      where: { patientId: patient.id, status: "ACTIVE" },
    }),
    prisma.medicalHistory.findFirst({
      where: { patientId: patient.id },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const allergies = Array.isArray(medicalHistory?.allergies) ? medicalHistory.allergies.length : 0;
  const medications = Array.isArray(medicalHistory?.medications) ? medicalHistory.medications.length : 0;
  const conditions = [
    medicalHistory?.hasDiabetes && "Diabetes",
    medicalHistory?.hasStroke && "Stroke history",
    medicalHistory?.hasHeartAttack && "Heart attack history",
  ].filter(Boolean) as string[];

  const modeLabel = { VIDEO: "Video consultation", CHAT: "Chat consultation", IN_PERSON: "In-person visit" } as const;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top bar: search, notification bell, profile avatar and emergency guidance */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {greetingFor()}, {patient.firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Your personal health command centre</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/doctors"
            className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm transition-colors hover:bg-muted"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
            Find care
          </Link>
          <EmergencyButton />
        </div>
      </div>

      {/* Primary actions */}
      <nav aria-label="Primary actions" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {primaryActions.map(action => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm font-medium transition-colors hover:bg-muted/50"
          >
            <action.icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            {action.label}
          </Link>
        ))}
      </nav>

      <NotificationsCard items={notifications.map(n => ({ ...n, createdAt: n.createdAt.toISOString() }))} />

      {/* Widgets: urgent and time-sensitive first, one clear primary action each */}
      <div className="grid gap-3 sm:grid-cols-2">
        <WidgetCard
          title="Upcoming appointment"
          icon={Calendar}
          status={
            nextAppointment
              ? { tone: nextAppointment.status === "CONFIRMED" ? "success" : "warning", label: nextAppointment.status === "CONFIRMED" ? "Confirmed" : "Booked" }
              : { tone: "neutral", label: "None" }
          }
          action={{ href: "/patient/appointments", label: "View appointments" }}
        >
          {nextAppointment ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium">{nextAppointment.doctor.user.name}</p>
              {nextAppointment.doctor.specialty && (
                <p className="text-xs text-muted-foreground">{nextAppointment.doctor.specialty}</p>
              )}
              <p className="text-xs text-muted-foreground">{formatClinicDateTime(nextAppointment.scheduledAt)}</p>
              <p className="text-xs text-muted-foreground">{modeLabel[nextAppointment.mode]}</p>
              <p className="text-xs text-muted-foreground">Case {patient.caseNumber}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming appointments. Book a consultation to get started.</p>
          )}
        </WidgetCard>

        <WidgetCard
          title="Pending results"
          icon={FlaskConical}
          status={pendingResults > 0 ? { tone: "warning", label: `${pendingResults} pending` } : { tone: "success", label: "None pending" }}
          action={{ href: "/patient/results", label: "View status" }}
        >
          <p className="text-sm text-muted-foreground">
            {pendingResults > 0
              ? `${pendingResults} ${pendingResults === 1 ? "test or report is" : "tests and reports are"} being processed or awaiting release.`
              : "No results are currently being processed for you."}
          </p>
        </WidgetCard>

        <WidgetCard
          title="New results"
          icon={Activity}
          status={newResults > 0 ? { tone: "info", label: `${newResults} new` } : { tone: "neutral", label: "None" }}
          action={{ href: "/patient/results", label: "View result" }}
        >
          <p className="text-sm text-muted-foreground">
            {newResults > 0
              ? `${newResults} ${newResults === 1 ? "result was" : "results were"} released in the last 7 days.`
              : "No new results in the last 7 days. Results appear here when your doctor or laboratory releases them."}
          </p>
        </WidgetCard>

        <WidgetCard
          title="Unread messages"
          icon={MessageSquare}
          status={unreadMessages > 0 ? { tone: "info", label: `${unreadMessages} unread` } : { tone: "neutral", label: "None" }}
          action={{ href: "/patient/consult", label: "Open messages" }}
        >
          <p className="text-sm text-muted-foreground">
            {unreadMessages > 0
              ? `You have ${unreadMessages} unread secure ${unreadMessages === 1 ? "message" : "messages"} from your care team.`
              : "No unread messages from your doctors or facilities."}
          </p>
        </WidgetCard>

        <WidgetCard
          title="Payments"
          icon={Receipt}
          status={
            failedPayments > 0
              ? { tone: "danger", label: `${failedPayments} failed` }
              : unpaidPayments > 0
                ? { tone: "warning", label: `${unpaidPayments} unpaid` }
                : { tone: "success", label: "Up to date" }
          }
          action={{ href: "/payments", label: unpaidPayments > 0 ? "Pay now" : "View receipt" }}
        >
          <p className="text-sm text-muted-foreground">
            {failedPayments > 0
              ? `${failedPayments} ${failedPayments === 1 ? "payment has failed" : "payments have failed"} and ${unpaidPayments > 0 ? `${unpaidPayments} ${unpaidPayments === 1 ? "booking is" : "bookings are"} awaiting payment.` : "may need to be retried."}`
              : unpaidPayments > 0
                ? `${unpaidPayments} ${unpaidPayments === 1 ? "booking is" : "bookings are"} awaiting payment.`
                : "No unpaid bookings. Receipts for completed payments are stored in your account."}
          </p>
        </WidgetCard>

        <WidgetCard
          title="Prescriptions"
          icon={Pill}
          status={activePrescriptions > 0 ? { tone: "success", label: `${activePrescriptions} active` } : { tone: "neutral", label: "None" }}
          action={{ href: "/patient/prescriptions", label: "View prescriptions" }}
        >
          <p className="text-sm text-muted-foreground">
            {activePrescriptions > 0
              ? `You have ${activePrescriptions} active ${activePrescriptions === 1 ? "prescription" : "prescriptions"}.`
              : "No active prescriptions."}
          </p>
        </WidgetCard>

        <WidgetCard
          title="Health summary"
          icon={HeartPulse}
          status={{ tone: conditions.length > 0 ? "warning" : "neutral", label: conditions.length > 0 ? "Conditions recorded" : "No conditions recorded" }}
          action={{ href: "/patient/case-file", label: "Edit medical summary" }}
        >
          <div className="space-y-1 text-sm">
            <p className="text-xs text-muted-foreground">Blood group</p>
            <p className="font-medium">{patient.bloodGroup ?? "Not recorded"}</p>
            <p className="text-xs text-muted-foreground">
              Allergies: {allergies > 0 ? `${allergies} recorded` : "None recorded"} · Medications: {medications > 0 ? `${medications} current` : "None"}
            </p>
            {conditions.length > 0 && (
              <p className="text-xs text-muted-foreground">Chronic conditions: {conditions.join(", ")}</p>
            )}
            <p className="text-xs text-muted-foreground">Recorded from your medical intake and visits.</p>
          </div>
        </WidgetCard>
      </div>

      <PatientCareSections data={workspace} />
    </div>
  );
}