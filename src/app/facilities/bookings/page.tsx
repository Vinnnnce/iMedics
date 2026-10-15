import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppointmentActions } from "@/components/shared/appointment-actions";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { isPayable } from "@/lib/payments/shape";
import { formatMoney } from "@/lib/money";
import { formatClinicDateTime } from "@/lib/format";

const STATUS_LABEL = { REQUESTED: "Awaiting facility", CONFIRMED: "Confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled" } as const;

export default async function PatientFacilityBookingsPage() {
  const user = await requirePageRole("PATIENT");
  const bookings = await prisma.facilityBooking.findMany({
    where: { patient: { userId: user.id } },
    orderBy: { preferredAt: "desc" },
    take: 100,
    include: {
      service: { select: { facility: { select: { laboratoryName: true, user: { select: { name: true } } } } } },
      payment: { select: { id: true, status: true, expiresAt: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My service bookings</h1>
        <Link href="/facilities">
          <Button className="rounded-lg bg-foreground text-background">Browse services</Button>
        </Link>
      </div>
      {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet.</p>}
      {bookings.map((b) => (
        <Card key={b.id} className="beeline-card">
          <CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/10">
                <CalendarCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{b.serviceName}</p>
                  <Badge variant="secondary" className="rounded-lg text-xs">
                    {STATUS_LABEL[b.status]}
                  </Badge>
                  {b.payment && <PaymentStatusBadge status={b.payment.status} />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {b.service.facility.laboratoryName || b.service.facility.user.name} · {formatClinicDateTime(b.preferredAt)} · {Number(b.amount) > 0 ? formatMoney(b.amount.toString(), b.currency) : "Free"}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {b.payment && isPayable(b.payment) && b.status === "REQUESTED" && (
                <Link href={`/payments/${b.payment.id}`}>
                  <Button size="sm" className="rounded-lg bg-foreground text-background">
                    Pay now
                  </Button>
                </Link>
              )}
              {(b.status === "REQUESTED" || b.status === "CONFIRMED") && (
                <AppointmentActions basePath="/facility-bookings" appointmentId={b.id} actions={[{ label: "Cancel", status: "CANCELLED" }]} />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
