import { NextResponse } from "next/server";
import { z } from "zod";
import type { FacilityBookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { conflict, forbidden, notFound, badRequest } from "@/lib/errors";
import { facilityBookingVisible } from "@/lib/facilities";
import { PAID_STATUSES } from "@/lib/payments/config";
import { isRefundEligible, settlePaymentOnCancellation } from "@/lib/payments/service";
import { queueNotification } from "@/lib/notifications/service";
import { writeAudit } from "@/lib/audit";
import { facilityBookingInclude, serializeFacilityBooking } from "@/lib/facility-booking-shape";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { roleHasPermission } from "@/lib/facility-staff";
import { transitionAllowed, WORKFLOW_STAGE_LABEL } from "@/lib/facility-workflow";

const patchSchema = z.object({
  status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED"]).optional(),
  workflowStage: z
    .enum([
      "BOOKED", "CHECKED_IN", "SAMPLE_COLLECTED", "SAMPLE_RECEIVED", "PROCESSING",
      "RESULT_ENTERED", "VERIFIED", "APPROVED", "PROCEDURE_COMPLETED", "IMAGES_UPLOADED",
      "REPORT_DRAFTED", "REVIEWED", "RELEASED", "AMENDED", "ARCHIVED",
    ])
    .optional(),
  assignedStaffId: z.string().uuid().optional(),
  reportDocumentKey: z.string().min(1).max(200).optional(),
});

const TRANSITIONS: Record<FacilityBookingStatus, FacilityBookingStatus[]> = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

// PATCH /api/facility-bookings/[id]
//  - facilities: confirm, complete or cancel bookings, advance the operational
//    workflow (check-in → sample/result → release) and assign staff
//  - patients: cancel their own booking (refunded under the same rules as consultations)
export const PATCH = withAuth<{ id: string }>(["PATIENT", "LAB_SCIENTIST"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const body = await parseBody(req, patchSchema);

  // Staff act for a facility only when they ask for the facility scope
  // (?scope=facility) or hold the legacy LAB_SCIENTIST owner role.
  const actingAsStaff = user.role === "LAB_SCIENTIST" || new URL(req.url).searchParams.get("scope") === "facility";

  const access: Prisma.FacilityBookingWhereInput = actingAsStaff
    ? { AND: [{ service: { facilityId: (await requireFacilityAccess(user, null, req)).facility.id } }, facilityBookingVisible] }
    : { patient: { userId: user.id } };

  const booking = await prisma.facilityBooking.findFirst({
    where: { AND: [{ id }, access] },
    select: {
      status: true,
      preferredAt: true,
      workflowStage: true,
      patient: { select: { userId: true, id: true } },
      service: { select: { facility: { select: { userId: true, id: true } }, referralRequired: true } },
      payment: true,
    },
  });
  if (!booking) throw notFound("Booking not found");

  if (body.status === undefined && body.workflowStage === undefined && body.assignedStaffId === undefined) {
    throw badRequest("Provide a status or workflowStage to update");
  }

  if (actingAsStaff) {
    return staffPatch(req, user, id, booking, body);
  }

  if (body.status === undefined || body.status !== "CANCELLED") throw forbidden("Patients can only cancel bookings");
  if (!TRANSITIONS[booking.status].includes(body.status)) {
    throw conflict(`A booking that is ${booking.status.toLowerCase()} cannot be changed to ${body.status.toLowerCase()}`);
  }

  const updated = await prisma.facilityBooking.update({ where: { id }, data: { status: body.status }, include: facilityBookingInclude });

  if (body.status === "CANCELLED") {
    const refund = isRefundEligible({ cancelledBy: user.role, wasConfirmed: booking.status === "CONFIRMED", startsAt: booking.preferredAt });
    await settlePaymentOnCancellation(booking.payment, refund, "Cancelled by the patient");
  }

  // The facility only learns of a patient's cancellation if the booking had been paid (or was free).
  const facilityKnows = !booking.payment || (PAID_STATUSES as readonly string[]).includes(booking.payment.status);
  if (facilityKnows) await queueNotification(booking.service.facility.userId, { kind: "FACILITY_BOOKING_UPDATED", bookingId: id });

  await writeAudit({ userId: user.id, actorRole: user.role, action: `FACILITY_BOOKING_${body.status}`, resourceType: "FacilityBooking", resourceId: id, req });
  return NextResponse.json({ booking: serializeFacilityBooking(updated) });
});

async function staffPatch(
  req: Request,
  user: import("@prisma/client").User,
  id: string,
  booking: {
    status: FacilityBookingStatus;
    preferredAt: Date;
    workflowStage: import("@prisma/client").FacilityBookingWorkflowStage;
    patient: { userId: string | null; id: string };
    service: { facility: { userId: string; id: string }; referralRequired: boolean };
    payment: unknown;
  },
  body: z.infer<typeof patchSchema>,
): Promise<Response> {
  const access = await requireFacilityAccess(user, null, req);
  const data: Prisma.FacilityBookingUpdateInput = {};

  if (body.status !== undefined) {
    if (!roleHasPermission(access.facilityRole, "MANAGE_BOOKINGS")) {
      throw forbidden("Your role does not allow changing booking status");
    }
    if (!TRANSITIONS[booking.status].includes(body.status)) {
      throw conflict(`A booking that is ${booking.status.toLowerCase()} cannot be changed to ${body.status.toLowerCase()}`);
    }
    if (body.status === "CONFIRMED" && booking.payment && (booking.payment as { status?: string }).status !== "SUCCESSFUL") {
      throw conflict("This booking has not been paid for");
    }
    data.status = body.status;
  }

  if (body.assignedStaffId !== undefined) {
    if (!roleHasPermission(access.facilityRole, "MANAGE_BOOKINGS")) {
      throw forbidden("Your role does not allow assigning staff");
    }
    const staff = await prisma.facilityStaff.findFirst({
      where: { id: body.assignedStaffId, facilityId: access.facility.id, status: "ACTIVE" },
      select: { id: true },
    });
    if (!staff) throw notFound("Staff member not found");
    data.assignedStaff = { connect: { id: body.assignedStaffId } };
  }

  let released = false;
  if (body.workflowStage !== undefined && body.workflowStage !== booking.workflowStage) {
    const transition = transitionAllowed(booking.workflowStage, body.workflowStage);
    if (!transition) {
      throw conflict(
        `The workflow cannot move from ${WORKFLOW_STAGE_LABEL[booking.workflowStage]} to ${WORKFLOW_STAGE_LABEL[body.workflowStage]}`,
      );
    }
    if (!roleHasPermission(access.facilityRole, transition.permission)) {
      throw forbidden("Your role does not allow this workflow step");
    }
    // A service that requires a referral cannot progress past check-in without one on file.
    if (
      body.workflowStage !== "BOOKED" &&
      body.workflowStage !== "CHECKED_IN" &&
      booking.service.referralRequired
    ) {
      const withDoc = await prisma.facilityBooking.findUnique({
        where: { id },
        select: { referralDocumentKey: true },
      });
      if (!withDoc?.referralDocumentKey) {
        throw conflict("This service requires a referral before the workflow can advance");
      }
    }
    data.workflowStage = body.workflowStage;
    data.workflowUpdatedAt = new Date();
    if (body.workflowStage === "RELEASED") {
      released = true;
      data.releasedAt = new Date();
      if (body.reportDocumentKey) data.reportDocumentKey = body.reportDocumentKey;
    }
  }

  // Compare-and-set: a concurrent update that already moved the workflow or
  // status is rejected instead of silently overwriting.
  const claimed = await prisma.facilityBooking.updateMany({
    where: { id, workflowStage: booking.workflowStage, status: booking.status },
    data: data as Prisma.FacilityBookingUpdateInput,
  });
  if (claimed.count === 0) throw conflict("This booking changed while you were updating it — reload and try again");

  const updated = await prisma.facilityBooking.findUniqueOrThrow({ where: { id }, include: facilityBookingInclude });

  if (data.status === "CANCELLED") {
    const refund = isRefundEligible({ cancelledBy: "LAB_SCIENTIST", wasConfirmed: booking.status === "CONFIRMED", startsAt: booking.preferredAt });
    await settlePaymentOnCancellation(booking.payment as never, refund, "Cancelled by the facility");
  }

  if (released) {
    // RELEASED is the only stage that makes the result visible to the patient.
    await queueNotification(booking.patient.userId, { kind: "FACILITY_RESULT_RELEASED", bookingId: id });
  } else if (body.status !== undefined || body.workflowStage !== undefined) {
    await queueNotification(booking.patient.userId, { kind: "FACILITY_BOOKING_UPDATED", bookingId: id });
  }

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "FACILITY_BOOKING_UPDATED",
    resourceType: "FacilityBooking",
    resourceId: id,
    details: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.workflowStage !== undefined ? { workflowStage: body.workflowStage } : {}),
      ...(body.assignedStaffId !== undefined ? { assignedStaffId: body.assignedStaffId } : {}),
    },
    facilityId: access.facility.id,
    patientId: booking.patient.id,
    req,
  });
  return NextResponse.json({ booking: serializeFacilityBooking(updated) });
}
