/**
 * Tests for the medication order workflow route
 * (PATCH /api/facility/his/medication-orders/[id]).
 * Covers permission gates, prescriber-only cancellation, workflow validation
 * and the FEFO stock decrement + controlled-substance register on DISPENSED.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const fns = ["findFirst", "findMany", "findUnique", "create", "update", "updateMany", "count"] as const;
  const make = () => Object.fromEntries(fns.map((f) => [f, vi.fn()]));
  return {
    prisma: {
      medicationOrder: make(),
      pharmacyStockBatch: make(),
      formularyItem: make(),
      controlledSubstanceEvent: make(),
      ePrescriptionOutbox: make(),
      auditLog: make(),
      $transaction: vi.fn(),
    },
  };
});
vi.mock("@/lib/api", () => ({
  withAuth: (_roles: unknown, handler: (req: Request, ctx: unknown) => Promise<Response>) => async (req: Request, ctx: unknown) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      const status = (error as { status?: number })?.status ?? ((error as { issues?: unknown })?.issues ? 400 : 500);
      return new Response(JSON.stringify({ error: (error as Error)?.message ?? "error" }), { status, headers: { "content-type": "application/json" } });
    }
  },
  parseBody: async (req: Request, schema: { parse: (v: unknown) => unknown }) => schema.parse(await req.json()),
  parseId: (value: string) => value,
}));
vi.mock("@/lib/his/access", () => ({
  requireHisAccess: vi.fn().mockResolvedValue({
    user: { id: "user-1" },
    facility: { id: "facility-1" },
    kind: "HOSPITAL",
    permissions: ["REVIEW_MEDICATIONS", "ORDER_MEDICATIONS"],
  }),
  hasPermission: (access: { permissions: string[] }, permission: string) => access.permissions.includes(permission),
}));
vi.mock("@/lib/his/audit", () => ({ auditHis: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/his/medication-safety", () => ({ buildEPrescriptionPayload: () => ({ ok: true }) }));

import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { requireHisAccess } from "@/lib/his/access";

const URL = "https://care.example/api/facility/his/medication-orders/order-1";

function makeCtx() {
  return { user: { id: "user-1" }, params: Promise.resolve({ id: "order-1" }) } as never;
}

function patchRequest(body: unknown) {
  return new NextRequest(URL, { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

const ORDER = {
  id: "order-1",
  status: "REVIEWED",
  medicationName: "Morphine 10mg/mL",
  strength: "10mg/mL",
  dose: "2 mg",
  route: "IV",
  frequency: "q4h",
  duration: "10",
  notes: null,
  prescriberId: "user-1",
  patientId: "patient-1",
  patient: { caseNumber: "CASE-000001" },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireHisAccess).mockResolvedValue({
    user: { id: "user-1" },
    facility: { id: "facility-1" },
    kind: "HOSPITAL",
    permissions: ["REVIEW_MEDICATIONS", "ORDER_MEDICATIONS"],
  } as never);
  vi.mocked(prisma.$transaction).mockImplementation(((fn: (tx: unknown) => unknown) => fn(prisma)) as never);
});

describe("PATCH /api/facility/his/medication-orders/[id]", () => {
  it("dispenses with FEFO stock decrement and writes the controlled register", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue(ORDER as never);
    vi.mocked(prisma.medicationOrder.update).mockResolvedValue({ ...ORDER, status: "DISPENSED" } as never);
    // two batches: the earlier-expiring one must be consumed first
    vi.mocked(prisma.pharmacyStockBatch.findMany).mockResolvedValue([
      { id: "batch-sooner", quantity: 6, expiresAt: new Date("2026-12-01") },
      { id: "batch-later", quantity: 50, expiresAt: new Date("2027-06-01") },
    ] as never);
    vi.mocked(prisma.pharmacyStockBatch.update).mockResolvedValue({} as never);
    vi.mocked(prisma.formularyItem.findFirst).mockResolvedValue({ controlled: true } as never);
    vi.mocked(prisma.controlledSubstanceEvent.create).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const res = await PATCH(patchRequest({ status: "DISPENSED" }), makeCtx());
    expect(res.status).toBe(200);
    // duration "10" → quantity 10: take 6 from the sooner batch, 4 from the later one
    const calls = vi.mocked(prisma.pharmacyStockBatch.update).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toMatchObject({ where: { id: "batch-sooner" }, data: { quantity: { decrement: 6 } } });
    expect(calls[1][0]).toMatchObject({ where: { id: "batch-later" }, data: { quantity: { decrement: 4 } } });
    expect(prisma.controlledSubstanceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          facilityId: "facility-1",
          medicationName: "Morphine 10mg/mL",
          eventType: "DISPENSED",
          quantity: 10,
          patientId: "patient-1",
          staffId: "user-1",
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "PHARMACY_STOCK_DISPENSED", patientId: "patient-1" }),
      }),
    );
  });

  it("dispenses successfully even when no stock batches are tracked", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue(ORDER as never);
    vi.mocked(prisma.medicationOrder.update).mockResolvedValue({ ...ORDER, status: "DISPENSED" } as never);
    vi.mocked(prisma.pharmacyStockBatch.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.formularyItem.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const res = await PATCH(patchRequest({ status: "DISPENSED" }), makeCtx());
    expect(res.status).toBe(200);
    expect(prisma.controlledSubstanceEvent.create).not.toHaveBeenCalled();
  });

  it("does not touch stock for non-dispensing transitions", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ ...ORDER, status: "DRAFT" } as never);
    vi.mocked(prisma.medicationOrder.update).mockResolvedValue({ ...ORDER, status: "SUBMITTED" } as never);
    vi.mocked(prisma.ePrescriptionOutbox.create).mockResolvedValue({} as never);

    const res = await PATCH(patchRequest({ status: "SUBMITTED" }), makeCtx());
    expect(res.status).toBe(200);
    expect(prisma.pharmacyStockBatch.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("requires the pharmacy permission to dispense", async () => {
    const { requireHisAccess } = await import("@/lib/his/access");
    vi.mocked(requireHisAccess).mockResolvedValue({
      user: { id: "user-1" },
      facility: { id: "facility-1" },
      kind: "HOSPITAL",
      permissions: ["ORDER_MEDICATIONS"],
    } as never);
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue(ORDER as never);

    const res = await PATCH(patchRequest({ status: "DISPENSED" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("allows only the prescriber to cancel", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ ...ORDER, prescriberId: "someone-else" } as never);
    const res = await PATCH(patchRequest({ status: "CANCELLED" }), makeCtx());
    expect(res.status).toBe(403);
  });

  it("rejects invalid workflow transitions", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ ...ORDER, status: "DISPENSED" } as never);
    const res = await PATCH(patchRequest({ status: "REVIEWED" }), makeCtx());
    expect(res.status).toBe(409);
  });

  it("returns 404 for an order from another facility", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue(null as never);
    const res = await PATCH(patchRequest({ status: "DISPENSED" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("enqueues an e-prescription snapshot on submission", async () => {
    vi.mocked(prisma.medicationOrder.findFirst).mockResolvedValue({ ...ORDER, status: "DRAFT" } as never);
    vi.mocked(prisma.medicationOrder.update).mockResolvedValue({ ...ORDER, status: "SUBMITTED" } as never);
    vi.mocked(prisma.ePrescriptionOutbox.create).mockResolvedValue({} as never);

    const res = await PATCH(patchRequest({ status: "SUBMITTED" }), makeCtx());
    expect(res.status).toBe(200);
    expect(prisma.ePrescriptionOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ facilityId: "facility-1", orderId: "order-1", status: "PENDING" }),
      }),
    );
  });
});
