/**
 * Integration test for POST /api/users/register against a real database.
 * Skipped unless TEST_DATABASE_URL points at a migrated, disposable database:
 *   TEST_DATABASE_URL=postgresql://... npm test
 * (CI provisions a Postgres service and exports TEST_DATABASE_URL.)
 *
 * Regression coverage for the incident where a half-applied facility migration
 * left `audit_logs.facility_id` missing, so every audited write — registration
 * included — failed with a P2022 that surfaced as a bare "Internal server error".
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => void fn(),
}));

const authMock = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireUser: authMock.requireUser,
  requireRole: authMock.requireUser,
  getCurrentUser: authMock.requireUser,
}));

const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("POST /api/users/register", () => {
  let prisma: typeof import("@/lib/prisma").prisma;
  let POST: typeof import("@/app/api/users/register/route").POST;
  let NextRequestCtor: typeof import("next/server").NextRequest;

  const RUN = `reg-${Date.now().toString(36)}`;
  let seq = 0;
  let user: import("@prisma/client").User;

  const invoke = (body: object) =>
    POST(
      new NextRequestCtor("https://care.example/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "https://care.example" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({}) },
    );

  const basePayload = () => ({
    termsAccepted: true,
    firstName: "Test",
    lastName: "User",
    gender: "other",
    dateOfBirth: "1990-01-01",
    documents: [{ name: "license.pdf", url: "blob:fake", size: 1024 }],
  });

  beforeAll(async () => {
    ({ NextRequest: NextRequestCtor } = await import("next/server"));
    prisma = (await import("@/lib/prisma")).prisma;
    ({ POST } = await import("@/app/api/users/register/route"));
  });

  beforeEach(async () => {
    authMock.requireUser.mockImplementation(() => Promise.resolve(user));
    seq += 1;
    user = await prisma.user.create({
      data: {
        clerkId: `${RUN}-clerk-${seq}`,
        email: `${RUN}-${seq}@example.com`,
        name: "Test User",
        phone: "+2348031234567",
      },
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("registers a patient (active, no verification required)", async () => {
    const response = await invoke({
      ...basePayload(),
      accountType: "patient",
      address: "1 Test Street",
      city: "Lagos",
      state: "Lagos",
      emergencyContactName: "Contact",
      emergencyContactPhone: "+2348031234568",
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      role: "PATIENT",
      status: "ACTIVE",
      requiresVerification: false,
    });

    const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
    expect(patient?.firstName).toBe("Test");

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.onboardingComplete).toBe(true);
    expect(updated?.status).toBe("ACTIVE");
  });

  it("registers a doctor (pending verification)", async () => {
    const response = await invoke({
      ...basePayload(),
      accountType: "doctor",
      mdcnRegistrationNumber: "MDCN-1",
      mdcnLicenseNumber: "LIC-1",
      yearOfRegistration: "2020",
      yearsOfExperience: "5",
      specialty: "Internal Medicine",
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      status: "PENDING",
      requiresVerification: true,
    });

    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: user.id } });
    expect(doctor?.licenseNumber).toBe("LIC-1");
    expect(doctor?.verificationStatus).toBe("PENDING");
  });

  it.each(["laboratory", "diagnostic_centre", "hospital"] as const)(
    "registers a %s without an internal server error",
    async (accountType) => {
      const response = await invoke({
        ...basePayload(),
        accountType,
        organisationName: "Test Facility Ltd",
        organisationType: "Laboratory",
        cacRegistrationNumber: "CAC-12345",
        facilityLicenseNumber: "FAC-67890",
      });
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        success: true,
        status: "PENDING",
        requiresVerification: true,
      });

      const profile = await prisma.labStaffProfile.findUnique({ where: { userId: user.id } });
      expect(profile?.laboratoryName).toBe("Test Facility Ltd");
      expect(profile?.facilityLicenseNumber).toBe("FAC-67890");
      expect(profile?.verificationStatus).toBe("PENDING");

      // The audit-log write is part of registration; it must succeed (see the incident note).
      const audit = await prisma.auditLog.findFirst({
        where: { userId: user.id, action: "REGISTRATION_SUBMITTED" },
      });
      expect(audit).not.toBeNull();

      const updated = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updated?.onboardingComplete).toBe(true);
      expect(updated?.status).toBe("PENDING");
    },
  );
});
