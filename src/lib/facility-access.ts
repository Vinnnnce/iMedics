import type { Prisma, User } from "@prisma/client";
import { getVerifiedFacilityProfile } from "./access";
/** Without an order-to-facility relation, use an explicit booking or caller's own uploaded result. */
export async function facilityPatientWhere(user: User): Promise<Prisma.PatientWhereInput> {
  const facility = await getVerifiedFacilityProfile(user);
  return { deletedAt: null, OR: [
    { facilityBookings: { some: { service: { facilityId: facility.id }, status: { in: ["REQUESTED", "CONFIRMED", "COMPLETED"] },
      OR: [{ payment: null }, { payment: { status: { in: ["SUCCESSFUL", "REFUND_PENDING", "REFUNDED"] } } }] } } },
    { labResults: { some: { uploadedById: user.id } } },
  ] };
}
