/**
 * Always-running tests for POST /api/users/register, exercising the real
 * `withAuth` wrapper (the database, S3 and audit/notify helpers are mocked).
 *
 * Regression coverage for the onboarding catch-22: the route must be usable by
 * accounts that are still incomplete or pending verification, and the profile
 * image requirement must be enforced server-side.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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

// S3 inspection is mocked; the pure key/URL helpers stay real.
vi.mock("@/lib/profile-images", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile-images")>()),
  verifyFinalProfileImage: vi.fn(() => Promise.resolve("image/png" as const)),
}));

vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/admin/notify", () => ({ notifyAdminsOfApplication: vi.fn() }));

const prismaTx = vi.hoisted(() => ({
  user: { update: vi.fn() },
  patient: { create: vi.fn() },
  doctorProfile: { create: vi.fn() },
  labStaffProfile: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...prismaTx,
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prismaTx)),
  },
}));

import { NextRequest } from "next/server";
import { POST } from "./route";
import { verifyFinalProfileImage } from "@/lib/profile-images";

const USER_ID = "11111111-2222-4333-8444-555555555555";

// A user mid-onboarding: incomplete and pending — exactly who this route is for.
const onboardingUser = {
  id: USER_ID,
  role: "PATIENT",
  status: "PENDING",
  onboardingComplete: false,
  deletedAt: null,
};

const invoke = (body: object) =>
  POST(
    new NextRequest("https://care.example/api/users/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://care.example",
      },
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
  phone: "+2348031234567",
  address: "1 Test Street",
  city: "Lagos",
  state: "Lagos",
});

const ownedImageKey = () =>
  `profile-images/${USER_ID}/0f0e0d0c-0b0a-4009-8008-700600500400`;

describe("POST /api/users/register (onboarding)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.requireUser.mockResolvedValue(onboardingUser);
  });

  it("accepts an incomplete, pending account (no readiness catch-22)", async () => {
    const response = await invoke({ ...basePayload(), accountType: "patient" });
    expect(response.status).toBe(201);
    expect(prismaTx.user.update).toHaveBeenCalled();
  });

  it("registers a patient when the wizard sends profileImageKey: null", async () => {
    const response = await invoke({
      ...basePayload(),
      accountType: "patient",
      profileImageKey: null,
    });
    expect(response.status).toBe(201);
    const updateData = prismaTx.user.update.mock.calls[0][0].data;
    expect(updateData.avatarUrl).toBeUndefined();
    expect(updateData.status).toBe("ACTIVE");
  });

  it("rejects a doctor without a profile photo", async () => {
    const response = await invoke({
      ...basePayload(),
      accountType: "doctor",
      mdcnRegistrationNumber: "MDCN-1",
      mdcnLicenseNumber: "LIC-1",
      yearOfRegistration: "2020",
      specialty: "Internal Medicine",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "A profile photo is required to complete your registration",
    });
    expect(prismaTx.user.update).not.toHaveBeenCalled();
  });

  it("registers a doctor with an owned image key and attaches it as the avatar", async () => {
    const key = ownedImageKey();
    const response = await invoke({
      ...basePayload(),
      accountType: "doctor",
      mdcnRegistrationNumber: "MDCN-1",
      mdcnLicenseNumber: "LIC-1",
      yearOfRegistration: "2020",
      specialty: "Internal Medicine",
      profileImageKey: key,
    });
    expect(response.status).toBe(201);
    expect(verifyFinalProfileImage).toHaveBeenCalledWith(key);
    const updateData = prismaTx.user.update.mock.calls[0][0].data;
    expect(updateData.avatarUrl).toBe(
      `/api/profile-images/${USER_ID}/0f0e0d0c-0b0a-4009-8008-700600500400`,
    );
    expect(updateData.status).toBe("PENDING");
    expect(prismaTx.doctorProfile.create).toHaveBeenCalled();
  });

  it.each(["laboratory", "diagnostic_centre", "hospital"] as const)(
    "rejects a %s without a logo",
    async (accountType) => {
      const response = await invoke({
        ...basePayload(),
        accountType,
        organisationName: "Test Facility Ltd",
        cacRegistrationNumber: "CAC-12345",
        facilityLicenseNumber: "FAC-67890",
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: "An organisation logo is required to complete your registration",
      });
    },
  );

  it("registers an organisation with an owned image key and attaches it as the logo", async () => {
    const key = ownedImageKey();
    const response = await invoke({
      ...basePayload(),
      accountType: "laboratory",
      organisationName: "Test Facility Ltd",
      cacRegistrationNumber: "CAC-12345",
      facilityLicenseNumber: "FAC-67890",
      profileImageKey: key,
    });
    expect(response.status).toBe(201);
    const createData = prismaTx.labStaffProfile.create.mock.calls[0][0].data;
    expect(createData.logoUrl).toBe(
      `/api/profile-images/${USER_ID}/0f0e0d0c-0b0a-4009-8008-700600500400`,
    );
  });

  it("registers a pharmacy as a pending facility with the PHARMACY kind", async () => {
    const key = ownedImageKey();
    const response = await invoke({
      ...basePayload(),
      accountType: "pharmacy",
      organisationName: "Test Pharmacy Ltd",
      cacRegistrationNumber: "CAC-54321",
      facilityLicenseNumber: "PHARM-24680",
      profileImageKey: key,
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      status: "PENDING",
      requiresVerification: true,
    });
    const userData = prismaTx.user.update.mock.calls[0][0].data;
    expect(userData.accountType).toBe("PHARMACY");
    const profileData = prismaTx.labStaffProfile.create.mock.calls[0][0].data;
    expect(profileData.kind).toBe("PHARMACY");
    expect(profileData.facilityLicenseNumber).toBe("PHARM-24680");
  });

  it("rejects an image key owned by someone else", async () => {
    const response = await invoke({
      ...basePayload(),
      accountType: "doctor",
      mdcnRegistrationNumber: "MDCN-1",
      mdcnLicenseNumber: "LIC-1",
      yearOfRegistration: "2020",
      specialty: "Internal Medicine",
      profileImageKey:
        "profile-images/deadbeef-dead-4dead-8dead-deaddeaddead/0f0e0d0c-0b0a-4009-8008-700600500400",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid profile image",
    });
  });
});
