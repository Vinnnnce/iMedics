import type { Prisma } from "@prisma/client";

export const facilityBookingInclude = {
  patient: { select: { id: true, firstName: true, lastName: true } },
  service: {
    select: {
      id: true,
      name: true,
      description: true,
      availability: true,
      facility: { select: { id: true, laboratoryName: true, addressLine: true, city: true, state: true, operatingHours: true, user: { select: { name: true } } } },
    },
  },
  payment: { select: { id: true, status: true, amount: true, currency: true, expiresAt: true, receiptNumber: true } },
} satisfies Prisma.FacilityBookingInclude;

export type FacilityBookingWithRelations = Prisma.FacilityBookingGetPayload<{ include: typeof facilityBookingInclude }>;

export function serializeFacilityBooking(booking: FacilityBookingWithRelations) {
  const { patient, service, payment, amount, ...rest } = booking;
  const { facility, ...svc } = service;
  return {
    ...rest,
    amount: Number(amount),
    patient: { id: patient.id, name: `${patient.firstName} ${patient.lastName}` },
    service: svc,
    facility: {
      id: facility.id,
      name: facility.laboratoryName || facility.user.name,
      addressLine: facility.addressLine,
      city: facility.city,
      state: facility.state,
      operatingHours: facility.operatingHours,
    },
    payment: payment && { ...payment, amount: Number(payment.amount) },
  };
}
