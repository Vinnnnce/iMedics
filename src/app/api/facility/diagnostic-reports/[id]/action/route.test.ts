/**
 * Acceptance tests for diagnostic report actions (Module 03): finalization
 * snapshots the report as version 1, amendments require a reason and create a
 * new immutable version (originals preserved), and organizations of the wrong
 * kind are refused (spec sections 6, 9, 11, scenarios 4-6, 9-10).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ requireRole: vi.fn(), requireUser: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    facilityStaff: { findMany: vi.fn() },
    labStaffProfile: { findUnique: vi.fn(), findFirst: vi.fn() },
    diagnosticReport: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    diagnosticReportVersion: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notifyUser: vi.fn() }));

import { NextRequest } from "next/server";
import { POST } from "./route";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const USER_ID = "11111111-2222-4333-8444-555555555555";
const DIAG_ID = "99999999-8888-4777-9666-555555555555";
const HOSPITAL_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const REPORT_ID = "abcdefab-cdef-4abc-8def-0123456789ab";
const BOOKING_ID = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const USER = { id: USER_ID, role: "LAB_SCIENTIST", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never;

function mockFacility(facilityId: string, kind: string | null) {
  vi.mocked(requireUser).mockResolvedValue(USER);
  vi.mocked(prisma.facilityStaff.findMany).mockResolvedValue([
    { id: "staff-1", userId: USER_ID, facilityRole: "OWNER", status: "ACTIVE", facility: { id: facilityId, verificationStatus: "VERIFIED" } },
  ] as never);
  vi.mocked(prisma.labStaffProfile.findUnique).mockResolvedValue({ kind } as never);
}

const invoke = (body: unknown) =>
  POST(new NextRequest(`https://care.example/api/facility/diagnostic-reports/${REPORT_ID}/action`, {
    method: "POST",
    body: JSON.stringify(body),
  }), { user: USER, params: Promise.resolve({ id: REPORT_ID }) } as never);

const REPORT = {
  id: REPORT_ID,
  status: "AWAITING_VERIFICATION",
  bookingId: BOOKING_ID,
  facilityId: DIAG_ID,
  preliminaryFindings: "Ground-glass opacities in the right lower lobe.",
  specialistInterpretation: "Consistent with infectious process.",
  recommendations: "Follow-up in 6 weeks.",
  booking: { requestingFacilityId: HOSPITAL_ID, patient: { userId: "p1" } },
};

function mockReport(status: string) {
  vi.mocked(prisma.diagnosticReport.findFirst).mockResolvedValue({ ...REPORT, status } as never);
  vi.mocked(prisma.diagnosticReport.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.diagnosticReportVersion.findFirst).mockResolvedValue({ version: 1 } as never);
  vi.mocked(prisma.diagnosticReportVersion.create).mockResolvedValue({ id: "v2" } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("diagnostic report actions", () => {
  it("finalizes a verified report and snapshots a new immutable version", async () => {
    mockFacility(DIAG_ID, "DIAGNOSTIC_CENTRE");
    mockReport("AWAITING_VERIFICATION");
    const res = await invoke({ action: "FINALIZE" });
    expect(res.status).toBe(200);
    expect(prisma.diagnosticReport.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "FINALIZED",
        verifiedById: USER_ID,
        signedById: USER_ID,
        signedAt: expect.any(Date),
      }),
    }));
    expect(prisma.diagnosticReportVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reportId: REPORT_ID,
        version: 2,
        snapshot: expect.objectContaining({
          preliminaryFindings: "Ground-glass opacities in the right lower lobe.",
        }),
      }),
    }));
  });

  it("sends the finalized report to the requesting hospital", async () => {
    mockFacility(DIAG_ID, "DIAGNOSTIC_CENTRE");
    mockReport("FINALIZED");
    const res = await invoke({ action: "SEND" });
    expect(res.status).toBe(200);
    expect(prisma.diagnosticReport.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SENT", sentToFacilityId: HOSPITAL_ID }),
    }));
  });

  it("refuses an amendment without a reason (acceptance scenario 10)", async () => {
    mockFacility(DIAG_ID, "DIAGNOSTIC_CENTRE");
    mockReport("FINALIZED");
    const res = await invoke({ action: "AMEND", preliminaryFindings: "Corrected" });
    expect(res.status).toBe(422);
    expect(prisma.diagnosticReportVersion.create).not.toHaveBeenCalled();
  });

  it("records an amendment as a new version with the original preserved", async () => {
    mockFacility(DIAG_ID, "DIAGNOSTIC_CENTRE");
    mockReport("SENT");
    const res = await invoke({
      action: "AMEND",
      reason: "Measurement corrected after re-reading",
      specialistInterpretation: "Updated interpretation.",
    });
    expect(res.status).toBe(200);
    expect(prisma.diagnosticReport.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "AMENDED", specialistInterpretation: "Updated interpretation." }),
    }));
    expect(prisma.diagnosticReportVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        version: 2,
        reason: "Measurement corrected after re-reading",
        snapshot: expect.objectContaining({
          // The unchanged original field is preserved in the snapshot.
          preliminaryFindings: "Ground-glass opacities in the right lower lobe.",
        }),
      }),
    }));
  });

  it("refuses a hospital user access to diagnostic report actions (acceptance scenarios 4 and 6)", async () => {
    mockFacility(HOSPITAL_ID, "HOSPITAL");
    mockReport("AWAITING_VERIFICATION");
    const res = await invoke({ action: "FINALIZE" });
    expect(res.status).toBe(403);
    expect(prisma.diagnosticReport.updateMany).not.toHaveBeenCalled();
  });

  it("refuses finalizing a report that is still a draft", async () => {
    mockFacility(DIAG_ID, "DIAGNOSTIC_CENTRE");
    mockReport("DRAFT");
    const res = await invoke({ action: "FINALIZE" });
    expect(res.status).toBe(422);
  });
});
