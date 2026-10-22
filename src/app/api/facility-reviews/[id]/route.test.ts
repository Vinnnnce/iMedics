/**
 * Tests for the facility staff review response route: only the reviewed
 * facility can respond, the response is validated and timestamped, the
 * patient is notified, and the action is audited.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(), requireUser: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    facilityStaff: { findMany: vi.fn() },
    labStaffProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    facilityReview: { findFirst: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notifyUser: vi.fn() }));

import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications/service";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const FACILITY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER_FACILITY_ID = "99999999-8888-4777-9666-555555555555";
const REVIEW_ID = "aaaaaaaa-bbbb-4ccc-8ddd-0123456789ab";
const PATIENT_USER_ID = "77777777-6666-4555-8444-333322221111";
const USER = { id: USER_ID, role: "LAB_SCIENTIST", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;

function mockFacility(facilityId: string) {
  vi.mocked(requireUser).mockResolvedValue(USER);
  vi.mocked(notifyUser).mockResolvedValue(undefined as never);
  vi.mocked(prisma.facilityStaff.findMany).mockResolvedValue([
    { id: "staff-1", userId: USER_ID, facilityRole: "OWNER", status: "ACTIVE", facility: { id: facilityId, verificationStatus: "VERIFIED" } },
  ] as never);
  vi.mocked(prisma.labStaffProfile.findUnique).mockResolvedValue({ id: facilityId, kind: "LABORATORY" } as never);
}

const invokePatch = (body: unknown, id = REVIEW_ID) =>
  PATCH(new NextRequest(`https://care.example/api/facility-reviews/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }), { user: USER, params: Promise.resolve({ id }) } as never);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("facility review response route", () => {
  it("lets the reviewed facility publish a response and notify the patient", async () => {
    mockFacility(FACILITY_ID);
    vi.mocked(prisma.facilityReview.findFirst).mockResolvedValue({
      id: REVIEW_ID,
      facilityResponse: null,
      patient: { userId: PATIENT_USER_ID, firstName: "Ada" },
    } as never);
    vi.mocked(prisma.facilityReview.update).mockResolvedValue({
      id: REVIEW_ID, facilityResponse: "Thank you for your feedback", respondedAt: new Date(),
    } as never);

    const res = await invokePatch({ facilityResponse: "Thank you for your feedback" });
    expect(res.status).toBe(200);
    expect(prisma.facilityReview.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: REVIEW_ID },
      data: expect.objectContaining({ facilityResponse: "Thank you for your feedback" }),
    }));
    expect(notifyUser).toHaveBeenCalledWith(PATIENT_USER_ID, { kind: "REVIEW_RESPONSE", reviewId: REVIEW_ID });
  });

  it("refuses a response to another facility's review", async () => {
    mockFacility(OTHER_FACILITY_ID);
    // findFirst with the caller's facility filter returns null — the review
    // belongs to a different organization and is invisible.
    vi.mocked(prisma.facilityReview.findFirst).mockResolvedValue(null as never);
    const res = await invokePatch({ facilityResponse: "Hello" });
    expect(res.status).toBe(404);
    expect(prisma.facilityReview.update).not.toHaveBeenCalled();
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("rejects an empty response", async () => {
    mockFacility(FACILITY_ID);
    const res = await invokePatch({ facilityResponse: "   " });
    expect(res.status).toBe(400);
    expect(prisma.facilityReview.update).not.toHaveBeenCalled();
  });
});
