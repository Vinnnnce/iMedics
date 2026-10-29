/**
 * Acceptance tests for the admissions route (Module 01): a hospital can list
 * and create admissions; a laboratory is refused by the kind gate (spec
 * sections 7 and 11, scenarios 3 and 7).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    facilityStaff: { findMany: vi.fn() },
    labStaffProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    patient: { findFirst: vi.fn() },
    admission: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    careCase: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notifyUser: vi.fn() }));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const HOSPITAL_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const LAB_ID = "99999999-8888-4777-9666-555555555555";
const PATIENT_ID = "12345678-1234-4abc-8def-001122334455";
const USER = { id: USER_ID, role: "LAB_SCIENTIST", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;

const invokeGet = () =>
  GET(new NextRequest(`https://care.example/api/facility/admissions`), { user: USER } as never);

const invokePost = (body: unknown) =>
  POST(new NextRequest("https://care.example/api/facility/admissions", {
    method: "POST",
    body: JSON.stringify(body),
  }), { user: USER } as never);

function mockFacility(facilityId: string, kind: string | null) {
  vi.mocked(requireUser).mockResolvedValue(USER);
  vi.mocked(prisma.facilityStaff.findMany).mockResolvedValue([
    { id: "staff-1", userId: USER_ID, facilityRole: "OWNER", status: "ACTIVE", facility: { id: facilityId, verificationStatus: "VERIFIED" } },
  ] as never);
  vi.mocked(prisma.labStaffProfile.findUnique).mockResolvedValue({ kind } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.admission.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: PATIENT_ID, userId: "u1" } as never);
  vi.mocked(prisma.admission.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.careCase.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.admission.create).mockResolvedValue({ id: "adm-1", status: "ACTIVE" } as never);
});

describe("admissions route — organization gating", () => {
  it("lets a hospital list its admissions", async () => {
    mockFacility(HOSPITAL_ID, "HOSPITAL");
    const res = await invokeGet();
    expect(res.status).toBe(200);
  });

  it("refuses a laboratory access to hospital admissions (acceptance scenario 3)", async () => {
    mockFacility(LAB_ID, "LABORATORY");
    const res = await invokeGet();
    expect(res.status).toBe(403);
  });

  it("refuses a diagnostic centre access to admissions (acceptance scenario 4)", async () => {
    mockFacility(LAB_ID, "DIAGNOSTIC_CENTRE");
    const res = await invokeGet();
    expect(res.status).toBe(403);
  });

  it("lets a hospital create an admission and refuses duplicates", async () => {
    mockFacility(HOSPITAL_ID, "HOSPITAL");
    const res = await invokePost({
      patientId: PATIENT_ID,
      admissionDate: new Date().toISOString(),
      reason: "Community-acquired pneumonia",
      ward: "Internal medicine",
    });
    expect(res.status).toBe(201);
    expect(prisma.admission.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ facilityId: HOSPITAL_ID, patientId: PATIENT_ID, status: "ACTIVE", reason: "Community-acquired pneumonia" }),
    }));

    vi.mocked(prisma.admission.findFirst).mockResolvedValue({ id: "existing" } as never);
    const dup = await invokePost({
      patientId: PATIENT_ID,
      admissionDate: new Date().toISOString(),
      reason: "Second episode",
    });
    expect(dup.status).toBe(409);
  });

  it("refuses a laboratory user creating admissions", async () => {
    mockFacility(LAB_ID, "LABORATORY");
    const res = await invokePost({
      patientId: PATIENT_ID,
      admissionDate: new Date().toISOString(),
      reason: "Not allowed",
    });
    expect(res.status).toBe(403);
    expect(prisma.admission.create).not.toHaveBeenCalled();
  });
});
