import { Calendar } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AppointmentActions } from "@/components/shared/appointment-actions";
import { prisma } from "@/lib/prisma";
import { getDoctorProfile, requirePageRole } from "@/lib/guards";
import { formatClinicDateTime } from "@/lib/format";

const MODE_LABEL = { VIDEO: "Video", CHAT: "Chat", IN_PERSON: "In person" } as const;

export default async function DoctorBookingRequestsPage() {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getDoctorProfile(user.id);
  if (!doctor) notFound();

  const appointments = await prisma.appointment.findMany({
    where: { doctorId: doctor.id, status: { in: ["BOOKED", "CONFIRMED"] }, scheduledAt: { gte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: 100,
    include: { patient: { select: { firstName: true, lastName: true, caseNumber: true } } },
  });

  const requests = appointments.filter((a) => a.status === "BOOKED");
  const confirmed = appointments.filter((a) => a.status === "CONFIRMED");

  const renderCard = (a: (typeof appointments)[number], actions: React.ReactNode) => (
    <Card key={a.id} className="beeline-card">
      <CardContent className="p-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/10">
              <Calendar className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">
                  {a.patient.firstName} {a.patient.lastName}
                </p>
                <Badge variant="outline" className="rounded-lg text-xs">
                  {MODE_LABEL[a.mode]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{formatClinicDateTime(a.scheduledAt)}</p>
              {a.reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {a.reason}</p>}
            </div>
          </div>
          {actions}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Booking Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Accepting a request also admits the patient to your care, so you can see their record.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Awaiting your reply ({requests.length})</h2>
        {requests.length === 0 && <p className="text-sm text-muted-foreground">No pending requests.</p>}
        {requests.map((a) =>
          renderCard(
            a,
            <AppointmentActions
              appointmentId={a.id}
              actions={[
                { label: "Accept", status: "CONFIRMED", primary: true },
                { label: "Decline", status: "CANCELLED" },
              ]}
            />,
          ),
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Confirmed ({confirmed.length})</h2>
        {confirmed.length === 0 && <p className="text-sm text-muted-foreground">No confirmed appointments.</p>}
        {confirmed.map((a) => renderCard(a, <AppointmentActions appointmentId={a.id} actions={[{ label: "Cancel", status: "CANCELLED" }]} />))}
      </section>
    </div>
  );
}
