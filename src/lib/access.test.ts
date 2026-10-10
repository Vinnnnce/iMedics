import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./prisma", () => ({
  prisma: { doctorProfile: { findUnique: vi.fn() }, patient: { findFirst: vi.fn() } },
}));

import { prisma } from "./prisma";
import { findAccessiblePatient, patientScope } from "./access";
import { ApiError } from "./errors";

const as = (role: string) => ({ id: "user-1", role }) as never;
const verifiedDoctor = { id: "doc-1", verificationStatus: "VERIFIED" };

beforeEach(() => vi.resetAllMocks());

describe("patientScope", () => {
  it("limits a verified doctor to patients assigned to them", async () => {
    vi.mocked(prisma.doctorProfile.findUnique).mockResolvedValue(verifiedDoctor as never);
    const scope = await patientScope(as("DOCTOR"));
    expect(scope.doctorId).toBe("doc-1");
    expect(scope.where).toEqual({ deletedAt: null, assignments: { some: { doctorId: "doc-1" } } });
  });

  it("requires an ACTIVE admission for writes", async () => {
    vi.mocked(prisma.doctorProfile.findUnique).mockResolvedValue(verifiedDoctor as never);
    const scope = await patientScope(as("DOCTOR"), { write: true });
    expect(scope.where).toEqual({ deletedAt: null, assignments: { some: { doctorId: "doc-1", status: "ACTIVE" } } });
  });

  it("rejects an unverified or missing doctor profile", async () => {
    vi.mocked(prisma.doctorProfile.findUnique).mockResolvedValue({ id: "doc-1", verificationStatus: "PENDING" } as never);
    await expect(patientScope(as("DOCTOR"))).rejects.toMatchObject({ status: 403 });
    vi.mocked(prisma.doctorProfile.findUnique).mockResolvedValue(null);
    await expect(patientScope(as("DOCTOR"))).rejects.toMatchObject({ status: 403 });
  });

  it("limits a patient to their own record", async () => {
    const scope = await patientScope(as("PATIENT"));
    expect(scope.where).toEqual({ deletedAt: null, userId: "user-1" });
  });

  it.each(["LAB_SCIENTIST", "ADMIN"])("gives %s no general access to patient records", async (role) => {
    await expect(patientScope(as(role))).rejects.toBeInstanceOf(ApiError);
  });
});

describe("findAccessiblePatient", () => {
  it("reports out-of-scope patients as not found", async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);
    await expect(findAccessiblePatient(as("PATIENT"), "p-1")).rejects.toMatchObject({ status: 404 });
  });

  it("returns the patient when in scope", async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: "p-1" } as never);
    await expect(findAccessiblePatient(as("PATIENT"), "p-1")).resolves.toMatchObject({ id: "p-1" });
  });
});
