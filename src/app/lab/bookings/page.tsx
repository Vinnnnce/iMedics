import { CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AppointmentActions } from "@/components/shared/appointment-actions";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { BookingWorkflowControls } from "@/components/lab/booking-workflow-controls";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { prisma } from "@/lib/prisma";
import { facilityBookingVisible } from "@/lib/facilities";
import { formatMoney } from "@/lib/money";
import { formatClinicDateTime } from "@/lib/format";
import { roleHasPermission, type FacilityStaffRole } from "@/lib/facility-staff";
import { allowedWorkflowTargets, WORKFLOW_STAGE_LABEL } from "@/lib/facility-workflow";

const STATUS_LABEL = { REQUESTED: "Awaiting your reply", CONFIRMED: "Confirmed", COMPLETED: "Completed", CANCELLED: "Cancelled" } as const;

export default async function LabBookingsPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);

  // The caller's facility role decides which workflow steps they may perform.
  const membership = await prisma.facilityStaff.findFirst({
    where: { userId: user.id, facilityId: profile.id, status: "ACTIVE" },
    select: { facilityRole: true },
  });
  const facilityRole: FacilityStaffRole = membership?.facilityRole ?? "OWNER";

  const bookings = await prisma.facilityBooking.findMany({
    where: { AND: [{ service: { facilityId: profile.id } }, facilityBookingVisible] },
    orderBy: { preferredAt: "asc" },
    take: 100,
    include: {
      patient: { select: { firstName: true, lastName: true } },
      payment: { select: { status: true } },
      assignedStaff: { select: { fullName: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Service bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bookings appear here once the patient has paid. Advance each booking through check-in, sample
          collection, results and release.
        </p>
      </div>
      {bookings.length === 0 && <p className="text-sm text-muted-foreground">No bookings yet.</p>}
      {bookings.map((b) => {
        const options =
          b.status === "CANCELLED"
            ? []
            : allowedWorkflowTargets(b.workflowStage)
                .filter((t) => roleHasPermission(facilityRole, t.permission))
                .map((t) => ({ stage: t.to, label: `→ ${WORKFLOW_STAGE_LABEL[t.to]}` }));
        return (
          <Card key={b.id} className="beeline-card">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
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
                      {b.assignedStaff && (
                        <Badge variant="outline" className="rounded-lg text-xs">Staff: {b.assignedStaff.fullName}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {b.patient.firstName} {b.patient.lastName} · {formatClinicDateTime(b.preferredAt)} · {Number(b.amount) > 0 ? formatMoney(b.amount.toString(), b.currency) : "Free"}
                    </p>
                  </div>
                </div>
                {b.status === "REQUESTED" && (
                  <AppointmentActions basePath="/facility-bookings" query="?scope=facility" appointmentId={b.id} actions={[{ label: "Confirm", status: "CONFIRMED", primary: true }, { label: "Decline", status: "CANCELLED" }]} />
                )}
                {b.status === "CONFIRMED" && (
                  <AppointmentActions basePath="/facility-bookings" query="?scope=facility" appointmentId={b.id} actions={[{ label: "Mark completed", status: "COMPLETED", primary: true }, { label: "Cancel", status: "CANCELLED" }]} />
                )}
              </div>
              <BookingWorkflowControls
                bookingId={b.id}
                currentLabel={WORKFLOW_STAGE_LABEL[b.workflowStage]}
                options={options}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
