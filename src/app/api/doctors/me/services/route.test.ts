import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111", role: "DOCTOR", status: "ACTIVE", onboardingComplete: true, deletedAt: null },
  auth: vi.fn(),
  doctor: vi.fn(),
  findDoctor: vi.fn(),
  createService: vi.fn(),
  findServices: vi.fn(),
  countAppointments: vi.fn(),
  resolveDiagnoses: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth, requireRole: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    doctorProfile: { findUniqueOrThrow: mocks.findDoctor },
    doctorService: { create: mocks.createService, findUnique: vi.fn(), update: vi.fn(), findMany: mocks.findServices },
    appointment: { count: mocks.countAppointments },
  },
}));
vi.mock("@/lib/access", () => ({ getVerifiedDoctorProfile: mocks.doctor }));
vi.mock("@/lib/icd10/service", () => ({ resolveDiagnoses: mocks.resolveDiagnoses }));
vi.mock("@/lib/audit", () => ({ writeAudit: mocks.audit }));

import { POST, GET } from "@/app/api/doctors/me/services/route";

const invoke = (body: object) =>
  POST(new NextRequest("https://care.example/api/doctors/me/services", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({}) });

const serviceBody = {
  kind: "NEW_PATIENT",
  name: "First consultation",
  description: null,
  modes: [],
  durationMinutes: 30,
  currency: "NGN",
  price: 5000,
  followUpPrice: null,
  followUpWindowDays: null,
  isActive: true,
  icd10Codes: [],
  cancellationTerms: null,
  refundTerms: null,
  includes: [],
  addOns: [],
};

describe("doctor service catalogue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue(mocks.user);
    mocks.doctor.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
    mocks.findDoctor.mockResolvedValue({ currency: "NGN" });
    mocks.resolveDiagnoses.mockResolvedValue({ release: { id: "rel" }, missing: [] });
    mocks.createService.mockImplementation(({ data }) => Promise.resolve({ ...data, id: "svc-1" }));
  });

  it("lists and creates a service for the verified doctor", async () => {
    const response = await invoke(serviceBody);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.service).toMatchObject({ name: "First consultation", price: 5000, currency: "NGN" });
    expect(mocks.createService).toHaveBeenCalledTimes(1);
    expect(mocks.createService.mock.calls[0][0].data.doctorId).toBe("22222222-2222-4222-8222-222222222222");
    expect(mocks.audit).toHaveBeenCalled();
  });

  it("rejects a service priced in another currency than the doctor's account", async () => {
    const response = await invoke({ ...serviceBody, currency: "USD" });
    expect(response.status).toBe(400);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("rejects unknown ICD-10 codes", async () => {
    mocks.resolveDiagnoses.mockResolvedValue({ release: { id: "rel" }, missing: ["ZZ99"] });
    const response = await invoke({ ...serviceBody, icd10Codes: ["ZZ99"] });
    expect(response.status).toBe(400);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("rejects the request when no ICD-10 release is imported", async () => {
    mocks.resolveDiagnoses.mockResolvedValue({ release: null, missing: [] });
    const response = await invoke({ ...serviceBody, icd10Codes: ["I10"] });
    expect(response.status).toBe(400);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("requires a doctor session", async () => {
    mocks.auth.mockRejectedValue(new ApiError(403, "forbidden"));
    const response = await invoke(serviceBody);
    expect([401, 403]).toContain(response.status);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("rejects an invalid body", async () => {
    const response = await invoke({ kind: "NEW_PATIENT" });
    expect(response.status).toBe(400);
    expect(mocks.createService).not.toHaveBeenCalled();
  });

  it("uppercases and deduplicates ICD-10 codes", async () => {
    await invoke({ ...serviceBody, icd10Codes: ["i10", "I10"] });
    expect(mocks.createService.mock.calls[0][0].data.icd10Codes).toEqual(["I10"]);
  });

  it("GET returns the doctor's services", async () => {
    mocks.findServices.mockResolvedValue([]);
    const response = await GET(new NextRequest("https://care.example/api/doctors/me/services"), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ services: [] });
  });
});
