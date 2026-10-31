import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(), requireRole: vi.fn() }));
vi.mock("@/lib/his/access", () => ({
  requireHisAccess: vi.fn(),
  assertPatientLinked: vi.fn(),
  hasPermission: (a: { permissions: string[] }, p: string) => a.permissions.includes(p),
}));
vi.mock("@/lib/his/audit", () => ({ auditHis: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    medicationOrder: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    medicalHistory: { findMany: vi.fn() },
    medicationInteractionRule: { findMany: vi.fn() },
    formularyItem: { findMany: vi.fn() },
    ePrescriptionOutbox: { create: vi.fn() },
  },
}));

import { requireUser } from "@/lib/auth";
import { requireHisAccess, assertPatientLinked } from "@/lib/his/access";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
import { POST as createOrder, GET as listOrders } from "./route";
import { PATCH as patchOrder } from "./[id]/route";

const PATIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORDER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const json = (method: string, path: string, body?: unknown) => new NextRequest(`http://localhost:3000${path}`, {
  method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const ctx = (id: string) => ({ user: { id: "doctor-1", role: "DOCTOR" }, params: Promise.resolve({ id }) } as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({ id: "doctor-1", role: "DOCTOR", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never);
  vi.mocked(requireHisAccess).mockResolvedValue({ facility: { id: "hospital-a" }, user: { id: "doctor-1", role: "DOCTOR" }, permissions: ["ORDER_MEDICATIONS", "VIEW_PATIENT_DOCUMENTS"] } as never);
  vi.mocked(assertPatientLinked).mockResolvedValue(undefined);
  // Default empty safety context for order creation (alerts/formulary lookups).
  vi.mocked(prisma.medicationOrder.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.medicalHistory.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.medicationInteractionRule.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.formularyItem.findMany).mockResolvedValue([] as never);
});

describe("creating medication orders", () => {
  it("creates a draft order attributed to the prescriber", async () => {
    vi.mocked(prisma.medicationOrder.create).mockResolvedValue({ id: "order-1" } as never);
    const res = await createOrder(json("POST", "/api/facility/his/medication-orders", {
      patientId: PATIENT, medicationName: "Amoxicillin", strength: "500 mg", dose: "1 tablet", route: "oral", frequency: "3x daily", duration: "7 days",
    }), { user: { id: "doctor-1", role: "DOCTOR" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(201);
    const created = vi.mocked(prisma.medicationOrder.create).mock.calls[0]![0].data;
    expect(created).toMatchObject({
      facilityId: "hospital-a", patientId: PATIENT, medicationName: "Amoxicillin",
      strength: "500 mg", dose: "1 tablet", route: "oral", frequency: "3x daily", duration: "7 days",
      prescriberId: "doctor-1", status: "DRAFT",
    });
  });

  it("requires the prescribing permission", async () => {
    vi.mocked(requireHisAccess).mockRejectedValue(new ApiError(403, "You do not have permission to order medications") as never);
    const res = await createOrder(json("POST", "/api/facility/his/medication-orders", {
      patientId: PATIENT, medicationName: "Amoxicillin",
    }), { user: { id: "doctor-1", role: "DOCTOR" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(403);
  });
});

describe("the order worklist", () => {
  it("returns orders with the patient's recorded allergies for visibility", async () => {
    vi.mocked(prisma.medicationOrder.findMany).mockResolvedValue([
      { id: "order-1", patientId: PATIENT, patient: { id: PATIENT, firstName: "A", lastName: "B", caseNumber: "C1", dateOfBirth: "1990-01-01" } },
    ] as never);
    vi.mocked(prisma.medicalHistory.findMany).mockResolvedValue([{ patientId: PATIENT, allergies: ["Penicillin"] }] as never);
    const res = await listOrders(new NextRequest("http://localhost:3000/api/facility/his/medication-orders?status=SUBMITTED"), { user: { id: "doctor-1", role: "DOCTOR" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    const { orders } = await res.json();
    expect(orders[0].allergies).toEqual(["Penicillin"]);
    const where = vi.mocked(prisma.medicationOrder.findMany).mock.calls[0]![0]!.where;
    expect(where).toMatchObject({ facilityId: "hospital-a", status: "SUBMITTED" });
  });
});

describe("workflow transitions", () => {
  it("walks an order through submit, review and dispense with the pharmacy permission", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue({ facility: { id: "hospital-a" }, user: { id: "pharm-1", role: "PHARMACIST" }, permissions: ["REVIEW_MEDICATIONS", "VIEW_PATIENT_DOCUMENTS"] } as never);
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ id: ORDER_ID, status: "SUBMITTED", patientId: PATIENT, prescriberId: "doctor-1" } as never);
    vi.mocked(prisma.medicationOrder.update).mockResolvedValue({ id: ORDER_ID, status: "REVIEWED" } as never);
    const res = await patchOrder(json("PATCH", "/api/facility/his/medication-orders/${ORDER_ID}", { status: "REVIEWED" }), ctx(ORDER_ID));
    expect(res.status).toBe(200);
    const updated = vi.mocked(prisma.medicationOrder.update).mock.calls[0]![0].data;
    expect(updated).toMatchObject({ status: "REVIEWED", reviewedById: "doctor-1" });
  });

  it("stamps the dispense time when dispensed", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue({ facility: { id: "hospital-a" }, user: { id: "pharm-1", role: "PHARMACIST" }, permissions: ["REVIEW_MEDICATIONS"] } as never);
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ id: ORDER_ID, status: "REVIEWED", patientId: PATIENT, prescriberId: "doctor-1" } as never);
    vi.mocked(prisma.medicationOrder.update).mockResolvedValue({ id: ORDER_ID, status: "DISPENSED" } as never);
    const res = await patchOrder(json("PATCH", "/api/facility/his/medication-orders/${ORDER_ID}", { status: "DISPENSED" }), ctx(ORDER_ID));
    expect(res.status).toBe(200);
    const updated = vi.mocked(prisma.medicationOrder.update).mock.calls[0]![0].data;
    expect(updated.status).toBe("DISPENSED");
    expect(updated.dispensedAt).toBeInstanceOf(Date);
  });

  it("blocks review and dispensing without the pharmacy permission", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ id: ORDER_ID, status: "SUBMITTED", patientId: PATIENT, prescriberId: "doctor-1" } as never);
    // Doctor without REVIEW_MEDICATIONS tries to dispense directly:
    const res = await patchOrder(json("PATCH", "/api/facility/his/medication-orders/${ORDER_ID}", { status: "REVIEWED" }), ctx(ORDER_ID));
    expect(res.status).toBe(403);
    const res2 = await patchOrder(json("PATCH", "/api/facility/his/medication-orders/${ORDER_ID}", { status: "DISPENSED" }), ctx(ORDER_ID));
    expect(res2.status).toBe(403);
  });

  it("blocks submitting an order without the prescribing permission", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue({ facility: { id: "hospital-a" }, user: { id: "nurse-1", role: "NURSE" }, permissions: ["RECORD_NURSING"] } as never);
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ id: ORDER_ID, status: "DRAFT", patientId: PATIENT, prescriberId: "doctor-1" } as never);
    const res = await patchOrder(json("PATCH", "/api/facility/his/medication-orders/${ORDER_ID}", { status: "SUBMITTED" }), ctx(ORDER_ID));
    expect(res.status).toBe(403);
  });

  it("lets only the prescriber cancel their order", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ id: ORDER_ID, status: "SUBMITTED", patientId: PATIENT, prescriberId: "doctor-2" } as never);
    const res = await patchOrder(json("PATCH", "/api/facility/his/medication-orders/${ORDER_ID}", { status: "CANCELLED" }), ctx(ORDER_ID));
    expect(res.status).toBe(403);
  });

  it("rejects transitions outside the lifecycle", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue({ facility: { id: "hospital-a" }, user: { id: "doctor-1", role: "DOCTOR" }, permissions: ["ORDER_MEDICATIONS", "REVIEW_MEDICATIONS"] } as never);
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ id: ORDER_ID, status: "DRAFT", patientId: PATIENT, prescriberId: "doctor-1" } as never);
    // Draft cannot be dispensed directly — pharmacy review comes first.
    const res = await patchOrder(json("PATCH", "/api/facility/his/medication-orders/${ORDER_ID}", { status: "DISPENSED" }), ctx(ORDER_ID));
    expect(res.status).toBe(409);
    const res2 = await patchOrder(json("PATCH", "/api/facility/his/medication-orders/${ORDER_ID}", { status: "REVIEWED" }), ctx(ORDER_ID));
    expect(res2.status).toBe(409);
  });

  it("scopes lookups to the caller's facility", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue(null as never);
    const res = await patchOrder(json("PATCH", "/api/facility/his/medication-orders/${ORDER_ID}", { status: "SUBMITTED" }), ctx(ORDER_ID));
    expect(res.status).toBe(404);
    expect(prisma.medicationOrder.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ facilityId: "hospital-a" }) }));
  });
});
