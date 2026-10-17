import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111", role: "DOCTOR", status: "ACTIVE", onboardingComplete: true, deletedAt: null },
  auth: vi.fn(),
  doctor: vi.fn(),
  findReview: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth, requireRole: mocks.auth }));
vi.mock("@/lib/access", () => ({ getVerifiedDoctorProfile: mocks.doctor }));
vi.mock("@/lib/prisma", () => ({
  prisma: { doctorReview: { findUnique: mocks.findReview, update: mocks.update } },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: mocks.audit }));

import { POST, DELETE } from "@/app/api/doctor-reviews/[id]/respond/route";

const REVIEW_ID = "44444444-4444-4444-8444-444444444444";
const DOCTOR_ID = "22222222-2222-4222-8222-222222222222";

const invoke = (method: "POST" | "DELETE", body?: object) =>
  (method === "POST" ? POST : DELETE)(
    new NextRequest(`https://care.example/api/doctor-reviews/${REVIEW_ID}/respond`, {
      method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
    }),
    { params: Promise.resolve({ id: REVIEW_ID }) },
  );

describe("doctor review responses", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue(mocks.user);
    mocks.doctor.mockResolvedValue({ id: DOCTOR_ID });
    mocks.findReview.mockResolvedValue({ id: REVIEW_ID, doctorId: DOCTOR_ID });
    mocks.update.mockImplementation(({ data }) => Promise.resolve({ id: REVIEW_ID, ...data }));
  });

  it("lets a doctor reply to a review of themselves", async () => {
    const response = await invoke("POST", { response: "Thank you for the feedback." });
    expect(response.status).toBe(200);
    const updateData = mocks.update.mock.calls[0][0].data;
    expect(updateData.doctorResponse).toBe("Thank you for the feedback.");
    expect(updateData.doctorRespondedAt).toBeInstanceOf(Date);
    expect(mocks.audit).toHaveBeenCalled();
  });

  it("refuses reviews belonging to another doctor", async () => {
    mocks.findReview.mockResolvedValue({ id: REVIEW_ID, doctorId: "99999999-9999-4999-8999-999999999999" });
    const response = await invoke("POST", { response: "nope" });
    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("refuses reviews that do not exist", async () => {
    mocks.findReview.mockResolvedValue(null);
    const response = await invoke("POST", { response: "nope" });
    expect(response.status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects an empty reply", async () => {
    const response = await invoke("POST", { response: "  " });
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("lets a doctor retract their reply", async () => {
    const response = await invoke("DELETE");
    expect(response.status).toBe(200);
    const updateData = mocks.update.mock.calls[0][0].data;
    expect(updateData.doctorResponse).toBeNull();
    expect(updateData.doctorRespondedAt).toBeNull();
  });
});
