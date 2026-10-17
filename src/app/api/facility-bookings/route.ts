import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { facilityBookingVisible } from "@/lib/facilities";
import { assertPaymentsAvailable, createPendingPayment, expireStalePayments } from "@/lib/payments/service";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { computeCommissionSplit } from "@/lib/payments/config";
import { queueNotification } from "@/lib/notifications/service";
import { writeAudit } from "@/lib/audit";
import { facilityBookingInclude, serializeFacilityBooking } from "@/lib/facility-booking-shape";
import { createCareCaseInTx, derivedStatusForFacilityBooking } from "@/lib/cases";

const bookSchema = z.object({
  serviceId: z.string().uuid(),
  preferredAt: z.coerce.date(),
});

// POST /api/facility-bookings — a patient books a priced service. The price is read from the service here, never
// from the client, and frozen on the booking. Paid bookings reach the facility once payment succeeds.
export const POST = withAuth(["PATIENT"], async (req, { user }) => {
  const data = await parseBody(req, bookSchema);
  if (data.preferredAt.getTime() <= Date.now()) throw badRequest("Choose a time in the future");

  const patient = await prisma.patient.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
  if (!patient) throw conflict("Please complete your registration before booking");

  const service = await prisma.facilityService.findFirst({
    where: {
      id: data.serviceId,
      isActive: true,
      facility: { verificationStatus: "VERIFIED", user: { status: "ACTIVE", deletedAt: null } },
    },
    select: {
      id: true,
      name: true,
      price: true,
      currency: true,
      facility: { select: { userId: true, commissionBps: true, subaccountCode: true } },
    },
  });
  if (!service) throw notFound("Service not found");

  const amount = Number(service.price);
  if (amount > 0) assertPaymentsAvailable();
  await expireStalePayments();

  // Snapshot the Medic1905 commission split on the charge: the facility receives
  // the service fee minus the commission; Medic1905 receives only its commission.
  const commission = computeCommissionSplit(amount, {
    commissionBps: service.facility.commissionBps,
    subaccountCode: service.facility.subaccountCode,
  });

  const { booking, payment } = await prisma.$transaction(
    async (tx) => {
      // Each facility (diagnostic) booking opens a unified care-episode case;
      // the booking and its payment link to the same episode.
      const careCase = await createCareCaseInTx(tx, {
        type: "DIAGNOSTIC",
        patientId: patient.id,
        specialty: null,
        presentingComplaint: service.name,
        status: derivedStatusForFacilityBooking("REQUESTED"),
        actorId: user.id,
        note: `Facility service booked: ${service.name}`,
      });
      const created = await tx.facilityBooking.create({
        data: {
          patientId: patient.id,
          serviceId: service.id,
          caseId: careCase.id,
          serviceName: service.name,
          amount,
          currency: service.currency,
          preferredAt: data.preferredAt,
        },
        include: facilityBookingInclude,
      });
      const charge =
        amount > 0
          ? await createPendingPayment(tx, {
              kind: "FACILITY_SERVICE",
              payerId: user.id,
              payeeId: service.facility.userId,
              facilityBookingId: created.id,
              description: "Service fee",
              amount,
              currency: service.currency,
              commission,
            })
          : null;
      if (charge) {
        await tx.payment.update({ where: { id: charge.id }, data: { caseId: careCase.id } });
      }
      return { booking: created, payment: charge };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );

  if (!payment) await queueNotification(service.facility.userId, { kind: "FACILITY_BOOKING_REQUESTED", bookingId: booking.id });

  await writeAudit({ userId: user.id, actorRole: user.role, action: "FACILITY_BOOKING_CREATED", resourceType: "FacilityBooking", resourceId: booking.id, details: { amount, currency: service.currency }, req });

  return NextResponse.json(
    {
      booking: serializeFacilityBooking(booking),
      payment: payment && { id: payment.id, amount: Number(payment.amount), currency: payment.currency, status: payment.status, expiresAt: payment.expiresAt },
    },
    { status: 201 },
  );
});

const listSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) });

// GET /api/facility-bookings — patients see their own bookings; facilities see paid or free bookings for their services.
// Facility staff (any role) use ?scope=facility and may need ?facilityId= when they belong to several facilities.
export const GET = withAuth(["PATIENT", "LAB_SCIENTIST"], async (req, { user }) => {
  const { limit } = parseQuery(req, listSchema);
  const actingAsStaff = user.role === "LAB_SCIENTIST" || new URL(req.url).searchParams.get("scope") === "facility";
  const owner: Prisma.FacilityBookingWhereInput = actingAsStaff
    ? { AND: [{ service: { facilityId: (await requireFacilityAccess(user, null, req)).facility.id } }, facilityBookingVisible] }
    : { patient: { userId: user.id } };

  const bookings = await prisma.facilityBooking.findMany({ where: owner, orderBy: { preferredAt: "asc" }, take: limit, include: facilityBookingInclude });
  return NextResponse.json({ bookings: bookings.map(serializeFacilityBooking) });
});
