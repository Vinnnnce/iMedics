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
    medicationAdministration: { findMany: vi.fn(), create: vi.fn() },
    formularyItem: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    medicationInteractionRule: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    medicalHistory: { findMany: vi.fn() },
    ePrescriptionOutbox: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { prisma } from "@/lib/prisma";
import { POST as recordAdministration } from "./[id]/administrations/route";
import { GET as listAdministrations } from "./administrations/route";
import { POST as createOrder } from "./route";
import { PATCH as patchOrder } from "./[id]/route";
import { POST as createFormularyItem } from "../formulary/route";
import { PATCH as patchFormularyItem } from "../formulary/[id]/route";
import { POST as createRule } from "../interaction-rules/route";
import { PATCH as patchRule } from "../interaction-rules/[id]/route";
import { GET as listOutbox, POST as dispatchOutbox } from "../eprescribing/route";

const PATIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORDER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const RULE_ID = "abbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const json = (method: string, path: string, body?: unknown) => new NextRequest(`http://localhost:3000${path}`, {
  method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const ctx = (id: string) => ({ user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({ id }) } as never);

const nurseAccess = { facility: { id: "hospital-a" }, user: { id: "nurse-1", role: "NURSE" }, permissions: ["ADMINISTER_MEDICATIONS"] };
const pharmacistAccess = { facility: { id: "hospital-a" }, user: { id: "pharm-1", role: "PHARMACIST" }, permissions: ["REVIEW_MEDICATIONS", "MANAGE_FORMULARY"] };
const doctorAccess = { facility: { id: "hospital-a" }, user: { id: "doctor-1", role: "DOCTOR" }, permissions: ["ORDER_MEDICATIONS"] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({ id: "nurse-1", role: "NURSE", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never);
  vi.mocked(requireHisAccess).mockResolvedValue(nurseAccess as never);
  // Default empty safety context for order creation.
  vi.mocked(prisma.medicationOrder.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.medicalHistory.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.medicationInteractionRule.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.formularyItem.findMany).mockResolvedValue([] as never);
});

describe("MAR administration recording", () => {
  it("records an administration with author, timestamp and order context", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ id: ORDER_ID, status: "DISPENSED", patientId: PATIENT, dose: "1 tablet", route: "oral", encounterId: null } as never);
    vi.mocked(prisma.medicationAdministration.create).mockResolvedValue({ id: "mar-1" } as never);
    const res = await recordAdministration(json("POST", `/api/facility/his/medication-orders/${ORDER_ID}/administrations`, { status: "GIVEN" }), ctx(ORDER_ID));
    expect(res.status).toBe(201);
    const created = vi.mocked(prisma.medicationAdministration.create).mock.calls[0]![0].data;
    expect(created).toMatchObject({ orderId: ORDER_ID, patientId: PATIENT, status: "GIVEN", administeredById: "nurse-1", administeredDose: "1 tablet", route: "oral" });
    expect(created.administeredAt).toBeInstanceOf(Date);
  });

  it("rejects MAR entries against draft orders", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ id: ORDER_ID, status: "DRAFT", patientId: PATIENT } as never);
    const res = await recordAdministration(json("POST", `/api/facility/his/medication-orders/${ORDER_ID}/administrations`, { status: "GIVEN" }), ctx(ORDER_ID));
    expect(res.status).toBe(409);
  });

  it("requires the administration permission", async () => {
    vi.mocked(requireHisAccess).mockRejectedValue(new ApiError(403, "You do not have permission for this action") as never);
    const res = await recordAdministration(json("POST", `/api/facility/his/medication-orders/${ORDER_ID}/administrations`, { status: "GIVEN" }), ctx(ORDER_ID));
    expect(res.status).toBe(403);
  });

  it("lists the patient's MAR log", async () => {
    vi.mocked(prisma.medicationAdministration.findMany).mockResolvedValue([{ id: "mar-1" }] as never);
    const res = await listAdministrations(new NextRequest(`http://localhost:3000/api/facility/his/medication-orders/administrations?patientId=${PATIENT}`), { user: { id: "nurse-1", role: "NURSE" } } as never);
    expect(res.status).toBe(200);
    expect((await res.json()).administrations).toHaveLength(1);
  });
});

describe("safety alerts on order creation", () => {
  it("returns interaction and allergy alerts and the formulary match, advisory only", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue(doctorAccess as never);
    vi.mocked(prisma.medicationOrder.findMany).mockResolvedValue([{ medicationName: "Warfarin" }] as never);
    vi.mocked(prisma.medicalHistory.findMany).mockResolvedValue([{ allergies: ["Penicillin"] }] as never);
    vi.mocked(prisma.medicationInteractionRule.findMany).mockResolvedValue([
      { medicationA: "Warfarin", medicationB: "Aspirin", severity: "WARNING", description: "Bleeding risk (hospital-configured example)" },
    ] as never);
    vi.mocked(prisma.formularyItem.findMany).mockResolvedValue([{ highAlert: true }] as never);
    vi.mocked(prisma.medicationOrder.create).mockResolvedValue({ id: ORDER_ID } as never);
    const res = await createOrder(json("POST", "/api/facility/his/medication-orders", {
      patientId: PATIENT, medicationName: "Aspirin",
    }), { user: { id: "doctor-1", role: "DOCTOR" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.alerts).toHaveLength(1);
    expect(data.alerts[0]).toMatchObject({ kind: "INTERACTION", severity: "WARNING" });
    expect(data.formulary).toEqual({ matched: true, highAlert: true });
  });

  it("returns an allergy alert when the prescribed name contains a recorded allergen", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue(doctorAccess as never);
    vi.mocked(prisma.medicationOrder.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.medicalHistory.findMany).mockResolvedValue([{ allergies: ["Penicillin"] }] as never);
    vi.mocked(prisma.medicationInteractionRule.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.formularyItem.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.medicationOrder.create).mockResolvedValue({ id: ORDER_ID } as never);
    const res = await createOrder(json("POST", "/api/facility/his/medication-orders", {
      patientId: PATIENT, medicationName: "Penicillin G",
    }), { user: { id: "doctor-1", role: "DOCTOR" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.alerts).toHaveLength(1);
    expect(data.alerts[0]).toMatchObject({ kind: "ALLERGY", allergen: "Penicillin" });
  });
});

describe("e-prescribing outbox", () => {
  it("enqueues an outbound snapshot when an order is submitted", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue(doctorAccess as never);
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ id: ORDER_ID, status: "DRAFT", patientId: PATIENT, medicationName: "Aspirin", strength: null, dose: null, route: null, frequency: null, duration: null, notes: null, prescriberId: "doctor-1", encounterId: null, patient: { caseNumber: "QA-1" } } as never);
    vi.mocked(prisma.medicationOrder.update).mockResolvedValue({ id: ORDER_ID, status: "SUBMITTED" } as never);
    vi.mocked(prisma.ePrescriptionOutbox.create).mockResolvedValue({ id: "out-1" } as never);
    const res = await patchOrder(json("PATCH", `/api/facility/his/medication-orders/${ORDER_ID}`, { status: "SUBMITTED" }), ctx(ORDER_ID));
    expect(res.status).toBe(200);
    expect(prisma.ePrescriptionOutbox.create).toHaveBeenCalledTimes(1);
    const data = vi.mocked(prisma.ePrescriptionOutbox.create).mock.calls[0]![0].data;
    expect(data).toMatchObject({ facilityId: "hospital-a", orderId: ORDER_ID, status: "PENDING" });
    expect((data.payload as { order: { medicationName: string } }).order.medicationName).toBe("Aspirin");
  });

  it("lists the queue and reports the unconfigured endpoint honestly", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue(pharmacistAccess as never);
    vi.mocked(prisma.ePrescriptionOutbox.findMany).mockResolvedValue([{ id: "out-1", status: "PENDING", attempts: 0 }] as never);
    const res = await listOutbox(new NextRequest("http://localhost:3000/api/facility/his/eprescribing"), { user: { id: "pharm-1", role: "PHARMACIST" } } as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.outbox).toHaveLength(1);
    expect(data.endpointConfigured).toBe(false);
  });

  it("records failed delivery attempts without claiming transmission", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue(pharmacistAccess as never);
    vi.mocked(prisma.ePrescriptionOutbox.findMany).mockResolvedValue([{ id: "out-1", status: "PENDING", attempts: 0, payload: {}, order: {} }] as never);
    const res = await dispatchOutbox(new NextRequest("http://localhost:3000/api/facility/his/eprescribing", { method: "POST", body: "{}" }), { user: { id: "pharm-1", role: "PHARMACIST" } } as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ attempted: 1, delivered: 0, stillPending: 1, endpointConfigured: false });
    const updated = vi.mocked(prisma.ePrescriptionOutbox.update).mock.calls[0]![0].data;
    expect(updated.attempts).toBe(1);
    expect(updated.lastError).toContain("EPRESCRIBING_ENDPOINT");
  });
});

describe("formulary management", () => {
  it("adds an entry and rejects duplicates", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue(pharmacistAccess as never);
    vi.mocked(prisma.formularyItem.findFirst).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as never);
    vi.mocked(prisma.formularyItem.create).mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as never);
    const body = { medicationName: "Aspirin", strength: "100 mg", highAlert: true };
    const res = await createFormularyItem(json("POST", "/api/facility/his/formulary", body), { user: { id: "pharm-1", role: "PHARMACIST" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(201);
    const res2 = await createFormularyItem(json("POST", "/api/facility/his/formulary", body), { user: { id: "pharm-1", role: "PHARMACIST" }, params: Promise.resolve({}) } as never);
    expect(res2.status).toBe(409);
  });

  it("retires and restores entries instead of deleting them", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue(pharmacistAccess as never);
    vi.mocked(prisma.formularyItem.findFirst).mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", facilityId: "hospital-a" } as never);
    vi.mocked(prisma.formularyItem.update).mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", active: false } as never);
    const res = await patchFormularyItem(json("PATCH", "/api/facility/his/formulary/f-1", { action: "deactivate" }), { user: { id: "pharm-1", role: "PHARMACIST" }, params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }) } as never);
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.formularyItem.update).mock.calls[0]![0].data).toMatchObject({ active: false });
  });

  it("requires the formulary permission to write", async () => {
    vi.mocked(requireHisAccess).mockRejectedValue(new ApiError(403, "You do not have permission for this action") as never);
    const res = await createFormularyItem(json("POST", "/api/facility/his/formulary", { medicationName: "Aspirin" }), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(403);
  });
});

describe("interaction rule management", () => {
  it("adds a rule and rejects a self-pair", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue(pharmacistAccess as never);
    vi.mocked(prisma.medicationInteractionRule.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.medicationInteractionRule.create).mockResolvedValue({ id: RULE_ID } as never);
    const res = await createRule(json("POST", "/api/facility/his/interaction-rules", {
      medicationA: "Warfarin", medicationB: "Aspirin", severity: "WARNING", description: "Bleeding risk (hospital-configured example)",
    }), { user: { id: "pharm-1", role: "PHARMACIST" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(201);
    const res2 = await createRule(json("POST", "/api/facility/his/interaction-rules", {
      medicationA: "Warfarin", medicationB: "warfarin", severity: "WARNING", description: "x",
    }), { user: { id: "pharm-1", role: "PHARMACIST" }, params: Promise.resolve({}) } as never);
    expect(res2.status).toBe(400);
  });

  it("retires a rule", async () => {
    vi.mocked(requireHisAccess).mockResolvedValue(pharmacistAccess as never);
    vi.mocked(prisma.medicationInteractionRule.findFirst).mockResolvedValue({ id: RULE_ID, facilityId: "hospital-a" } as never);
    vi.mocked(prisma.medicationInteractionRule.update).mockResolvedValue({ id: RULE_ID, active: false } as never);
    const res = await patchRule(json("PATCH", `/api/facility/his/interaction-rules/${RULE_ID}`, { action: "deactivate" }), { user: { id: "pharm-1", role: "PHARMACIST" }, params: Promise.resolve({ id: RULE_ID }) } as never);
    expect(res.status).toBe(200);
  });
});
