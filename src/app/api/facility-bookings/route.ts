import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { getVerifiedFacilityProfile } from "@/lib/access";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { facilityBookingVisible } from "@/lib/facilities";
import { assertPaymentsAvailable, createPendingPayment, expireStalePayments } from "@/lib/payments/service";
import { queueNotification } from "@/lib/notifications/service";
import { writeAudit } from "@/lib/audit";
import { facilityBookingInclude, serializeFacilityBooking } from "@/lib/facility-booking-shape";

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
    select: { id: true, name: true, price: true, currency: true, facility: { select: { userId: true } } },
  });
  if (!service) throw notFound("Service not found");

  const amount = Number(service.price);
  if (amount > 0) assertPaymentsAvailable();
  await expireStalePayments();

  const { booking, payment } = await prisma.$transaction(
    async (tx) => {
      const created = await tx.facilityBooking.create({
        data: {
          patientId: patient.id,
          serviceId: service.id,
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
            })
          : null;
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
export const GET = withAuth(["PATIENT", "LAB_SCIENTIST"], async (req, { user }) => {
  const { limit } = parseQuery(req, listSchema);
  const owner: Prisma.FacilityBookingWhereInput =
    user.role === "PATIENT"
      ? { patient: { userId: user.id } }
      : { AND: [{ service: { facilityId: (await getVerifiedFacilityProfile(user)).id } }, facilityBookingVisible] };

  const bookings = await prisma.facilityBooking.findMany({ where: owner, orderBy: { preferredAt: "asc" }, take: limit, include: facilityBookingInclude });
  return NextResponse.json({ bookings: bookings.map(serializeFacilityBooking) });
});
