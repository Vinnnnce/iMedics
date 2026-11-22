import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findAccessiblePatient, getVerifiedDoctorProfile } from "@/lib/access";
import { forbidden, notFound } from "@/lib/errors";

/**
 * A doctor may work with an order they placed, or one for a patient in their
 * care (assignment). Writes (acknowledging, interpreting) need an ACTIVE
 * assignment or being the requesting doctor.
 */
export async function requireDoctorOrderAccess(user: User, orderId: string, options: { write?: boolean } = {}) {
  await getVerifiedDoctorProfile(user);
  const order = await prisma.investigation_orders.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order not found");
  if (order.requestedById === user.id) return order;
  try {
    await findAccessiblePatient(user, order.patientId, { write: options.write });
  } catch {
    throw notFound("Order not found");
  }
  return order;
}

/** Facility staff must act for the facility that performs (or ordered) the item. */
export async function requirePerformingFacilityItem(itemId: string, facilityId: string) {
  const item = await prisma.investigation_order_items.findFirst({
    where: { id: itemId, performingFacilityId: facilityId },
    include: { order: { include: { patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true, gender: true, dateOfBirth: true } } } } },
  });
  if (!item) throw notFound("Investigation not found");
  return item;
}

export function assertSubmittedOrder(status: string) {
  if (status === "DRAFT") throw forbidden("This order has not been submitted");
}
