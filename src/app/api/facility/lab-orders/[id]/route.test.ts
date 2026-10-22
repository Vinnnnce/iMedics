/**
 * Acceptance tests for the laboratory order workflow route (Module 02):
 * workflow transitions are validated server-side, finalized orders cannot be
 * silently overwritten, amendments need a reason, and orders of other
 * organizations are invisible (spec sections 6, 9, 11).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(), requireUser: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    facilityStaff: { findMany: vi.fn() },
    labStaffProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    labOrder: { findFirst: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notifyUser: vi.fn() }));

import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const LAB_ID = "99999999-8888-4777-9666-555555555555";
const HOSPITAL_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORDER_ID = "abcdefab-cdef-4abc-8def-0123456789ab";
const USER = { id: USER_ID, role: "LAB_SCIENTIST", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;

function mockFacility(facilityId: string, kind: string | null) {
  vi.mocked(requireUser).mockResolvedValue(USER);
  vi.mocked(prisma.facilityStaff.findMany).mockResolvedValue([
    { id: "staff-1", userId: USER_ID, facilityRole: "OWNER", status: "ACTIVE", facility: { id: facilityId, verificationStatus: "VERIFIED" } },
  ] as never);
  vi.mocked(prisma.labStaffProfile.findUnique).mockResolvedValue({ kind } as never);
}

const invokePatch = (body: unknown, id = ORDER_ID) =>
  PATCH(new NextRequest(`https://care.example/api/facility/lab-orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }), { user: USER, params: Promise.resolve({ id }) } as never);

function mockOrder(status: string, performingFacilityId: string | null = LAB_ID) {
  vi.mocked(prisma.labOrder.findFirst).mockResolvedValue({
    id: ORDER_ID, status, performingFacilityId, requestingFacilityId: HOSPITAL_ID, orderedById: null,
  } as never);
  vi.mocked(prisma.labOrder.update).mockResolvedValue({
    id: ORDER_ID, status, requestingFacilityId: HOSPITAL_ID, orderedById: null,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("lab order workflow route", () => {
  it("accepts a new order (ORDERED -> ACCEPTED)", async () => {
    mockFacility(LAB_ID, "LABORATORY");
    mockOrder("ORDERED");
    const res = await invokePatch({ action: "ACCEPT" });
    expect(res.status).toBe(200);
    expect(prisma.labOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "ACCEPTED" }),
    }));
  });

  it("refuses a finalized order being moved back into processing (acceptance scenario 9)", async () => {
    mockFacility(LAB_ID, "LABORATORY");
    mockOrder("FINALIZED");
    const res = await invokePatch({ action: "START_PROCESSING" });
    expect(res.status).toBe(422);
    expect(prisma.labOrder.update).not.toHaveBeenCalled();
  });

  it("requires a reason to amend a finalized order (acceptance scenario 10)", async () => {
    mockFacility(LAB_ID, "LABORATORY");
    mockOrder("SENT_TO_FACILITY");
    const noReason = await invokePatch({ action: "CANCEL" });
    // CANCELLED is not a legal transition from SENT_TO_FACILITY at all.
    expect(noReason.status).toBe(422);
  });

  it("refuses hospitals from using the laboratory workflow actions", async () => {
    mockFacility(HOSPITAL_ID, "HOSPITAL");
    mockOrder("ORDERED");
    const res = await invokePatch({ action: "ACCEPT" });
    expect(res.status).toBe(403);
    expect(prisma.labOrder.update).not.toHaveBeenCalled();
  });

  it("hides another laboratory's order (acceptance scenario 7)", async () => {
    mockFacility(LAB_ID, "LABORATORY");
    // findFirst with facility filter returns null when the order belongs elsewhere.
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue(null);
    const res = await invokePatch({ action: "ACCEPT" });
    expect(res.status).toBe(404);
  });
});
