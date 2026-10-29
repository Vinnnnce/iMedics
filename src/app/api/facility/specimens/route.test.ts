/**
 * Acceptance tests for the specimens route (Module 02): a laboratory can
 * register specimens against its orders; a hospital is refused; orders bound
 * to a different laboratory are invisible (404) — organization-level
 * isolation even when IDs are guessed (spec sections 7 and 11, scenarios 5-7).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(), requireUser: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    facilityStaff: { findMany: vi.fn() },
    labStaffProfile: { findUnique: vi.fn() },
    labOrder: { findUnique: vi.fn(), updateMany: vi.fn() },
    specimen: { findMany: vi.fn(), create: vi.fn() },
    facilityAccessionCounter: { upsert: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notifyUser: vi.fn() }));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const LAB_ID = "99999999-8888-4777-9666-555555555555";
const HOSPITAL_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER_LAB_ID = "77777777-6666-4555-9444-333333333333";
const ORDER_ID = "abcdefab-cdef-4abc-8def-0123456789ab";
const USER = { id: USER_ID, role: "LAB_SCIENTIST", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;

function mockFacility(facilityId: string, kind: string | null) {
  vi.mocked(requireUser).mockResolvedValue(USER);
  vi.mocked(prisma.facilityStaff.findMany).mockResolvedValue([
    { id: "staff-1", userId: USER_ID, facilityRole: "OWNER", status: "ACTIVE", facility: { id: facilityId, verificationStatus: "VERIFIED" } },
  ] as never);
  vi.mocked(prisma.labStaffProfile.findUnique).mockResolvedValue({ kind } as never);
}

const invokeGet = () =>
  GET(new NextRequest("https://care.example/api/facility/specimens"), { user: USER } as never);

const invokePost = (body: unknown) =>
  POST(new NextRequest("https://care.example/api/facility/specimens", {
    method: "POST",
    body: JSON.stringify(body),
  }), { user: USER } as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.specimen.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.facilityAccessionCounter.upsert).mockResolvedValue({ sequence: 7 } as never);
  vi.mocked(prisma.specimen.create).mockResolvedValue({ id: "spc-1", accessionNumber: "SPC-2026-000007", status: "PENDING_COLLECTION" } as never);
  vi.mocked(prisma.labOrder.updateMany).mockResolvedValue({ count: 1 } as never);
});

describe("specimens route — organization gating", () => {
  it("lets a laboratory list its specimen queue", async () => {
    mockFacility(LAB_ID, "LABORATORY");
    const res = await invokeGet();
    expect(res.status).toBe(200);
  });

  it("refuses a hospital access to specimen management", async () => {
    mockFacility(HOSPITAL_ID, "HOSPITAL");
    const res = await invokeGet();
    expect(res.status).toBe(403);
  });

  it("registers a specimen with a facility-scoped accession number", async () => {
    mockFacility(LAB_ID, "LABORATORY");
    vi.mocked(prisma.labOrder.findUnique).mockResolvedValue({
      id: ORDER_ID, status: "ORDERED", performingFacilityId: LAB_ID,
    } as never);
    const res = await invokePost({ labOrderId: ORDER_ID, specimenType: "Venous blood" });
    expect(res.status).toBe(201);
    expect(prisma.specimen.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        labOrderId: ORDER_ID,
        facilityId: LAB_ID,
        accessionNumber: "SPC-2026-000007",
      }),
    }));
  });

  it("hides orders that belong to another laboratory (acceptance scenario 7)", async () => {
    mockFacility(LAB_ID, "LABORATORY");
    vi.mocked(prisma.labOrder.findUnique).mockResolvedValue({
      id: ORDER_ID, status: "ORDERED", performingFacilityId: OTHER_LAB_ID,
    } as never);
    const res = await invokePost({ labOrderId: ORDER_ID });
    expect(res.status).toBe(404);
    expect(prisma.specimen.create).not.toHaveBeenCalled();
  });

  it("claims an unassigned legacy order exactly once", async () => {
    mockFacility(LAB_ID, "LABORATORY");
    vi.mocked(prisma.labOrder.findUnique).mockResolvedValue({
      id: ORDER_ID, status: "ORDERED", performingFacilityId: null,
    } as never);
    const res = await invokePost({ labOrderId: ORDER_ID });
    expect(res.status).toBe(201);
    expect(prisma.labOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: ORDER_ID, performingFacilityId: null }),
      data: expect.objectContaining({ performingFacilityId: LAB_ID, status: "ACCEPTED" }),
    }));
  });
});
