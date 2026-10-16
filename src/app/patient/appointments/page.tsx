import Link from "next/link";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppointmentActions } from "@/components/shared/appointment-actions";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { ReschedulePanel } from "@/components/shared/reschedule-panel";
import { formatClinicDateTime } from "@/lib/format";
import { clinicToday } from "@/lib/clinic-time";
import { formatMoney } from "@/lib/money";
import { isPayable } from "@/lib/payments/shape";

const MODE_LABEL = { VIDEO: "Video", CHAT: "Chat", IN_PERSON: "In person" } as const;
const STATUS_LABEL = {
  BOOKED: "Awaiting doctor",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "Missed",
} as const;

export default async function PatientAppointmentsPage() {
  const user = await requirePageRole("PATIENT");

  const appointments = await prisma.appointment.findMany({
    where: { patient: { userId: user.id, deletedAt: null } },
    orderBy: { scheduledAt: "desc" },
    take: 100,
    include: {
      doctor: { select: { id: true, specialty: true, user: { select: { name: true } } } },
      payment: { select: { id: true, status: true, expiresAt: true } },
      consultations: { select: { case: { select: { id: true, caseNumber: true } } }, take: 1 },
    },
  });

  const now = new Date();
  const isUpcoming = (a: (typeof appointments)[number]) => (a.status === "BOOKED" || a.status === "CONFIRMED") && a.scheduledAt >= now;
  const upcoming = appointments.filter(isUpcoming).reverse();
  const past = appointments.filter((a) => !isUpcoming(a));

  const row = (a: (typeof appointments)[number], cancellable: boolean) => (
    <Card key={a.id} className="beeline-card">
      <CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/10">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/doctors/${a.doctor.id}`} className="text-sm font-semibold hover:underline">
                {a.doctor.user.name}
              </Link>
              <Badge variant="outline" className="rounded-lg text-xs">{MODE_LABEL[a.mode]}</Badge>
              <Badge variant="secondary" className="rounded-lg text-xs">{STATUS_LABEL[a.status]}</Badge>
              {a.consultations[0]?.case && (
                <Link href={`/patient/cases/${a.consultations[0].case.id}`}>
                  <Badge variant="outline" className="rounded-lg text-xs">{a.consultations[0].case.caseNumber}</Badge>
                </Link>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{formatClinicDateTime(a.scheduledAt)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                {a.feeKind === "FOLLOW_UP" ? "Follow-up · " : ""}
                {Number(a.feeAmount) > 0 ? formatMoney(a.feeAmount.toString(), a.feeCurrency) : "Free"}
              </span>
              {a.payment && <PaymentStatusBadge status={a.payment.status} />}
            </div>
            {a.reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {a.reason}</p>}
          </div>
        </div>
        {cancellable && (
          <div className="flex flex-col items-end gap-2">
            {a.payment && isPayable(a.payment) && (
              <Link href={`/payments/${a.payment.id}`}>
                <Button size="sm" className="rounded-lg bg-foreground text-background">
                  Pay now
                </Button>
              </Link>
            )}
            <div className="flex flex-wrap items-start justify-end gap-2">
              <ReschedulePanel appointmentId={a.id} doctorId={a.doctor.id} today={clinicToday()} />
              <AppointmentActions appointmentId={a.id} actions={[{ label: "Cancel", status: "CANCELLED" }]} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold">My Appointments</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your bookings and past visits</p>
        </div>
        <Link href="/doctors">
          <Button className="bg-foreground text-background rounded-lg">Book an appointment</Button>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Upcoming ({upcoming.length})</h2>
        {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming appointments.</p>}
        {upcoming.map((a) => row(a, true))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Past ({past.length})</h2>
        {past.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}
        {past.map((a) => row(a, false))}
      </section>
    </div>
  );
}
