import { NextResponse } from "next/server";
import { z } from "zod";
import type { FacilityBookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedFacilityProfile } from "@/lib/access";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { facilityBookingVisible } from "@/lib/facilities";
import { PAID_STATUSES } from "@/lib/payments/config";
import { isRefundEligible, settlePaymentOnCancellation } from "@/lib/payments/service";
import { queueNotification } from "@/lib/notifications/service";
import { writeAudit } from "@/lib/audit";
import { facilityBookingInclude, serializeFacilityBooking } from "@/lib/facility-booking-shape";

const patchSchema = z.object({ status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED"]) });

const TRANSITIONS: Record<FacilityBookingStatus, FacilityBookingStatus[]> = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

// PATCH /api/facility-bookings/[id]
//  - facilities: confirm, complete or cancel bookings for their services
//  - patients: cancel their own booking (refunded under the same rules as consultations)
export const PATCH = withAuth<{ id: string }>(["PATIENT", "LAB_SCIENTIST"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { status } = await parseBody(req, patchSchema);

  const access: Prisma.FacilityBookingWhereInput =
    user.role === "PATIENT"
      ? { patient: { userId: user.id } }
      : { AND: [{ service: { facilityId: (await getVerifiedFacilityProfile(user)).id } }, facilityBookingVisible] };

  const booking = await prisma.facilityBooking.findFirst({
    where: { AND: [{ id }, access] },
    select: {
      status: true,
      preferredAt: true,
      patient: { select: { userId: true } },
      service: { select: { facility: { select: { userId: true } } } },
      payment: true,
    },
  });
  if (!booking) throw notFound("Booking not found");

  if (user.role === "PATIENT" && status !== "CANCELLED") throw forbidden("Patients can only cancel bookings");
  if (!TRANSITIONS[booking.status].includes(status)) {
    throw conflict(`A booking that is ${booking.status.toLowerCase()} cannot be changed to ${status.toLowerCase()}`);
  }
  if (status === "CONFIRMED" && booking.payment && booking.payment.status !== "SUCCESSFUL") throw conflict("This booking has not been paid for");

  const updated = await prisma.facilityBooking.update({ where: { id }, data: { status }, include: facilityBookingInclude });

  if (status === "CANCELLED") {
    const refund = isRefundEligible({ cancelledBy: user.role, wasConfirmed: booking.status === "CONFIRMED", startsAt: booking.preferredAt });
    await settlePaymentOnCancellation(booking.payment, refund, user.role === "PATIENT" ? "Cancelled by the patient" : "Cancelled by the facility");
  }

  // The facility only learns of a patient's cancellation if the booking had been paid (or was free).
  const facilityKnows = !booking.payment || (PAID_STATUSES as readonly string[]).includes(booking.payment.status);
  if (user.role === "LAB_SCIENTIST") await queueNotification(booking.patient.userId, { kind: "FACILITY_BOOKING_UPDATED", bookingId: id });
  else if (facilityKnows) await queueNotification(booking.service.facility.userId, { kind: "FACILITY_BOOKING_UPDATED", bookingId: id });

  await writeAudit({ userId: user.id, actorRole: user.role, action: `FACILITY_BOOKING_${status}`, resourceType: "FacilityBooking", resourceId: id, req });
  return NextResponse.json({ booking: serializeFacilityBooking(updated) });
});
