import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const serviceSelect = {
  id: true,
  name: true,
  description: true,
  category: true,
  price: true,
  currency: true,
  turnaroundHours: true,
  availability: true,
} satisfies Prisma.FacilityServiceSelect;

const facilitySelect = {
  id: true,
  laboratoryName: true,
  addressLine: true,
  city: true,
  state: true,
  operatingHours: true,
  about: true,
  user: { select: { name: true, accountType: true } },
  services: { where: { isActive: true }, orderBy: { name: "asc" }, select: serviceSelect },
} satisfies Prisma.LabStaffProfileSelect;

type FacilityRow = Prisma.LabStaffProfileGetPayload<{ select: typeof facilitySelect }>;

/** Public shape of a facility: display name, location, hours and priced services. No licence or registration data. */
export function toPublicFacility(row: FacilityRow) {
  const { user, services, laboratoryName, ...rest } = row;
  return {
    ...rest,
    name: laboratoryName || user.name,
    type: user.accountType,
    services: services.map((s) => ({ ...s, price: Number(s.price) })),
  };
}
export type PublicFacility = ReturnType<typeof toPublicFacility>;

const visibleFacility: Prisma.LabStaffProfileWhereInput = {
  verificationStatus: "VERIFIED",
  user: { status: "ACTIVE", deletedAt: null },
};

export async function listFacilities(options: { search?: string; city?: string; category?: Prisma.FacilityServiceWhereInput["category"] } = {}) {
  const { search, city, category } = options;
  const rows = await prisma.labStaffProfile.findMany({
    where: {
      ...visibleFacility,
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      services: { some: { isActive: true, ...(category ? { category } : {}), ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) } },
    },
    orderBy: { laboratoryName: "asc" },
    take: 50,
    select: facilitySelect,
  });
  return rows.map(toPublicFacility);
}

export async function getFacility(id: string) {
  const row = await prisma.labStaffProfile.findFirst({ where: { id, ...visibleFacility }, select: facilitySelect });
  return row ? toPublicFacility(row) : null;
}

/** Facility staff see a booking only once it is free or paid, mirroring what doctors see for consultations. */
export const facilityBookingVisible: Prisma.FacilityBookingWhereInput = {
  OR: [{ payment: { is: null } }, { payment: { is: { status: { in: ["SUCCESSFUL", "REFUND_PENDING", "REFUNDED"] } } } }],
};
