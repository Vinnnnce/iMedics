/**
 * Always-running tests for facility reviews: public listing of approved
 * reviews, and patient submissions that upsert and recompute the facility's
 * aggregate rating transactionally.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    labStaffProfile: { findUnique: vi.fn(), update: vi.fn() },
    patient: { findUnique: vi.fn() },
    facilityReview: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const PATIENT_ID = "99998888-7777-4666-8555-444433332222";
const FACILITY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const USER = { id: USER_ID, role: "PATIENT", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;

const invokeGet = (facilityId: string) =>
  GET(new NextRequest(`https://care.example/api/facility-reviews?facilityId=${facilityId}`), {} as never);

const invokePost = (body: unknown) =>
  POST(new NextRequest("https://care.example/api/facility-reviews", {
    method: "POST",
    body: JSON.stringify(body),
  }), { user: USER } as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(USER);
  vi.mocked(prisma.labStaffProfile.findUnique).mockResolvedValue({ id: FACILITY_ID, verificationStatus: "VERIFIED" } as never);
  vi.mocked(prisma.patient.findUnique).mockResolvedValue({ id: PATIENT_ID } as never);
  vi.mocked(prisma.facilityReview.findMany).mockResolvedValue([
    {
      id: "rev-1", rating: 5, comment: "Great", facilityResponse: null,
      createdAt: new Date("2026-01-01T00:00:00Z"), patient: { firstName: "Ada" },
    },
  ] as never);
  vi.mocked(prisma.facilityReview.aggregate).mockResolvedValue({ _avg: { rating: 4.2 }, _count: { rating: 5 } } as never);
  vi.mocked(prisma.$transaction).mockImplementation(async fn => fn(prisma));
  vi.mocked(prisma.facilityReview.findUnique).mockResolvedValue(null as never);
  vi.mocked(prisma.facilityReview.create).mockResolvedValue({
    id: "rev-2", rating: 5, comment: "Great",
  } as never);
  vi.mocked(prisma.facilityReview.update).mockResolvedValue({ id: "rev-2", rating: 4 } as never);
});

describe("GET /api/facility-reviews", () => {
  it("lists approved reviews for a facility", async () => {
    const res = await invokeGet(FACILITY_ID);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reviews).toHaveLength(1);
    expect(data.reviews[0].author).toBe("Ada.");
    expect(data.reviews[0].patient).toBeUndefined();
  });

  it("404s for an unknown facility", async () => {
    vi.mocked(prisma.labStaffProfile.findUnique).mockResolvedValue(null as never);
    const res = await invokeGet(FACILITY_ID);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/facility-reviews", () => {
  it("creates a review and recomputes the aggregate", async () => {
    const res = await invokePost({ facilityId: FACILITY_ID, rating: 4, comment: "Solid" });
    expect(res.status).toBe(201);
    expect(prisma.facilityReview.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ facilityId: FACILITY_ID, patientId: PATIENT_ID, rating: 4 }) }),
    );
    expect(prisma.labStaffProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: FACILITY_ID }, data: expect.objectContaining({ ratingAvg: 4.2, ratingCount: 5 }) }),
    );
  });

  it("updates an existing review instead of duplicating", async () => {
    vi.mocked(prisma.facilityReview.findUnique).mockResolvedValue({ id: "rev-old", rating: 2 } as never);
    const res = await invokePost({ facilityId: FACILITY_ID, rating: 5 });
    expect(res.status).toBe(201);
    expect(prisma.facilityReview.update).toHaveBeenCalled();
    expect(prisma.facilityReview.create).not.toHaveBeenCalled();
  });

  it("rejects ratings outside 1-5", async () => {
    const res = await invokePost({ facilityId: FACILITY_ID, rating: 9 });
    expect(res.status).not.toBe(201);
    expect(prisma.facilityReview.create).not.toHaveBeenCalled();
  });

  it("rejects non-patients", async () => {
    vi.mocked(prisma.patient.findUnique).mockResolvedValue(null as never);
    const res = await invokePost({ facilityId: FACILITY_ID, rating: 4 });
    expect(res.status).toBe(403);
  });

  it("rejects unverified facilities", async () => {
    vi.mocked(prisma.labStaffProfile.findUnique).mockResolvedValue({ id: FACILITY_ID, verificationStatus: "PENDING" } as never);
    const res = await invokePost({ facilityId: FACILITY_ID, rating: 4 });
    expect(res.status).toBe(404);
  });
});
