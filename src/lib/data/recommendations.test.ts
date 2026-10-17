import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    doctorProfile: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    patient: { findMany: vi.fn() },
    labOrder: { findMany: vi.fn() },
    facilityBooking: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/data/doctors", () => ({
  listDoctors: vi.fn(async () => ({
    doctors: [{ id: "doc-1", specialty: "Cardiology", name: "Dr. Ada" }],
    total: 1,
  })),
}));
vi.mock("@/lib/public-facilities", () => ({
  listPublicFacilities: vi.fn(async ({ directory }: { directory: string }) => [
    {
      id: `fac-${directory}`,
      slug: `${directory}-slug`,
      laboratoryName: `${directory} One`,
      city: "Lagos",
      state: "LA",
    },
  ]),
}));
vi.mock("@/lib/facility-auth", () => ({
  resolveFacilityForPortalUser: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { listDoctors } from "@/lib/data/doctors";
import { listPublicFacilities } from "@/lib/public-facilities";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { getRecommendations } from "./recommendations";

const patientUser = { id: "user-p", role: "PATIENT", accountType: "PATIENT" } as never;
const doctorUser = { id: "user-d", role: "DOCTOR", accountType: "DOCTOR" } as never;
const labUser = { id: "user-l", role: "LAB_SCIENTIST", accountType: "LABORATORY" } as never;

function mockDoctorProfile(verificationStatus: string | null) {
  vi.mocked(prisma.doctorProfile.findFirst).mockResolvedValue(
    (verificationStatus ? { id: "doc-1", verificationStatus } : null) as never,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  // Re-apply the module-level default mocks after resetAllMocks clears implementations.
  vi.mocked(listDoctors).mockResolvedValue({
    doctors: [{ id: "doc-1", specialty: "Cardiology", name: "Dr. Ada" }],
    total: 1,
  } as never);
  vi.mocked(listPublicFacilities).mockImplementation(async ({ directory }) =>
    [{ id: `fac-${directory}`, slug: `${directory}-slug`, laboratoryName: `${directory} One`, city: "Lagos", state: "LA" }] as never,
  );
});

describe("getRecommendations", () => {
  it("suggests doctors and facilities to a patient", async () => {
    const categories = await getRecommendations(patientUser, null);

    expect(categories.map((c) => c.key)).toEqual(["doctors", "hospitals", "laboratories", "diagnosticCentres"]);
    expect(categories[0].items[0]).toMatchObject({ name: "Dr. Ada", href: "/doctors/doc-1" });
    expect(categories[1].items[0]).toMatchObject({ name: "hospitals One", href: "/hospitals/hospitals-slug" });
    expect(categories[3].items[0]).toMatchObject({ href: "/diagnostic-centres/diagnostic-centres-slug" });
  });

  it("suggests a doctor's assigned patients with only minimal fields", async () => {
    mockDoctorProfile("VERIFIED");
    vi.mocked(prisma.patient.findMany).mockResolvedValue([
      { id: "p-1", firstName: "Jane", lastName: "Okafor", caseNumber: "MC-001" },
    ] as never);

    const categories = await getRecommendations(doctorUser, null);

    expect(categories.map((c) => c.key)).toEqual(["patients", "hospitals", "laboratories", "diagnosticCentres"]);
    expect(categories[0].items[0]).toEqual({
      id: "p-1",
      name: "Jane Okafor",
      subtitle: "Case MC-001",
      href: "/patients/p-1",
    });
    // The patient query may only select the minimal identity fields.
    expect(vi.mocked(prisma.patient.findMany).mock.calls[0]![0]!.select).toEqual({
      id: true,
      firstName: true,
      lastName: true,
      caseNumber: true,
    });
  });

  it("keeps the patients category empty for an unverified doctor", async () => {
    mockDoctorProfile("PENDING_REVIEW");

    const categories = await getRecommendations(doctorUser, null);

    expect(categories.map((c) => c.key)).toEqual(["patients", "hospitals", "laboratories", "diagnosticCentres"]);
    expect(categories[0].items).toEqual([]);
    expect(prisma.patient.findMany).not.toHaveBeenCalled();
  });

  it("suggests facility-served patients to a laboratory, linked to the portal listings", async () => {
    mockDoctorProfile(null);
    vi.mocked(resolveFacilityForPortalUser).mockResolvedValue(
      { id: "fac-1", userId: "owner-1", verificationStatus: "VERIFIED" } as never,
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ accountType: "LABORATORY" } as never);
    vi.mocked(prisma.labOrder.findMany).mockResolvedValue([
      { patient: { id: "p-1", firstName: "Jane", lastName: "Okafor" } },
      { patient: { id: "p-2", firstName: "Ada", lastName: "Bello" } },
    ] as never);
    vi.mocked(prisma.facilityBooking.findMany).mockResolvedValue([
      { patient: { id: "p-2", firstName: "Ada", lastName: "Bello" } },
      { patient: { id: "p-3", firstName: "Chidi", lastName: "Eze" } },
    ] as never);

    const categories = await getRecommendations(labUser, null);

    expect(categories.map((c) => c.key)).toEqual(["doctors", "patients", "hospitals", "diagnosticCentres"]);
    const patients = categories[1].items;
    // Deduplicated by patient, orders first, capped at four.
    expect(patients.map((p) => p.id)).toEqual(["p-1", "p-2", "p-3"]);
    expect(patients[0]).toMatchObject({ name: "Jane Okafor", subtitle: "Open lab order", href: "/lab/orders" });
    expect(patients[2]).toMatchObject({ name: "Chidi Eze", subtitle: "Upcoming booking", href: "/lab/bookings" });

    // The orders query only accepts patients within the facility's authorized scope.
    const orderWhere = vi.mocked(prisma.labOrder.findMany).mock.calls[0]![0]!.where as Record<string, never>;
    expect(orderWhere.status).toEqual({ in: ["ORDERED", "IN_PROGRESS"] });
    expect((orderWhere.patient as never as { OR: unknown[] }).OR[1]).toEqual({
      labResults: { some: { uploadedById: "user-l" } },
    });
    // The bookings query is scoped to the facility.
    const bookingWhere = vi.mocked(prisma.facilityBooking.findMany).mock.calls[0]![0]!.where as never as {
      AND: Array<{ service?: { facilityId: string } }>;
    };
    expect(bookingWhere.AND[0]).toEqual({ service: { facilityId: "fac-1" } });
  });

  it("keeps patients hidden from an unverified facility", async () => {
    vi.mocked(resolveFacilityForPortalUser).mockResolvedValue(
      { id: "fac-1", userId: "owner-1", verificationStatus: "PENDING" } as never,
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ accountType: "HOSPITAL" } as never);

    const categories = await getRecommendations(labUser, null);

    expect(categories.map((c) => c.key)).toEqual(["doctors", "patients", "laboratories", "diagnosticCentres"]);
    expect(categories[1].items).toEqual([]);
    expect(prisma.labOrder.findMany).not.toHaveBeenCalled();
  });

  it("resolves a facility member acting for each facility account type", async () => {
    vi.mocked(resolveFacilityForPortalUser).mockResolvedValue(
      { id: "fac-1", userId: "owner-1", verificationStatus: "VERIFIED" } as never,
    );
    vi.mocked(prisma.labOrder.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.facilityBooking.findMany).mockResolvedValue([] as never);

    const expected: Record<string, string[]> = {
      HOSPITAL: ["doctors", "patients", "laboratories", "diagnosticCentres"],
      LABORATORY: ["doctors", "patients", "hospitals", "diagnosticCentres"],
      DIAGNOSTIC_CENTRE: ["doctors", "patients", "hospitals", "laboratories"],
    };
    for (const [accountType, keys] of Object.entries(expected)) {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ accountType } as never);
      const categories = await getRecommendations(patientUser, "facility");
      expect(categories.map((c) => c.key)).toEqual(keys);
    }
  });

  it("never suggests other patients' lab orders to facility staff without a lab account", async () => {
    // An invited staff member whose personal account is a patient: the orders
    // portal restricts them to their own orders, so order suggestions must not
    // leak other patients; booking suggestions remain (bookings portal access).
    vi.mocked(resolveFacilityForPortalUser).mockResolvedValue(
      { id: "fac-1", userId: "owner-1", verificationStatus: "VERIFIED" } as never,
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ accountType: "LABORATORY" } as never);
    vi.mocked(prisma.facilityBooking.findMany).mockResolvedValue([
      { patient: { id: "p-1", firstName: "Jane", lastName: "Okafor" } },
    ] as never);

    const categories = await getRecommendations(patientUser, "facility");

    expect(prisma.labOrder.findMany).not.toHaveBeenCalled();
    expect(categories.find((c) => c.key === "patients")?.items).toEqual([
      { id: "p-1", name: "Jane Okafor", subtitle: "Upcoming booking", href: "/lab/bookings" },
    ]);
  });

  it("rejects a patient asking for the doctor perspective", async () => {
    await expect(getRecommendations(patientUser, "doctor")).rejects.toMatchObject({ status: 403 });
  });

  it("rejects a doctor asking for the patient perspective", async () => {
    await expect(getRecommendations(doctorUser, "patient")).rejects.toMatchObject({ status: 403 });
  });

  it("returns no categories when the facility owner has no facility account type", async () => {
    vi.mocked(resolveFacilityForPortalUser).mockResolvedValue(
      { id: "fac-1", userId: "owner-1", verificationStatus: "VERIFIED" } as never,
    );
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ accountType: null } as never);

    await expect(getRecommendations(labUser, "facility")).resolves.toEqual([]);
  });
});
