/**
 * Tests for the bed lifecycle route (PATCH /api/facility/his/beds/[id]).
 * Covers the state machine: reservations require an admission, occupied beds
 * cannot be re-reserved, discharge frees the bed to CLEANING, cleaning returns
 * it to AVAILABLE, blocks require reasons and unblock only works on blocks.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const fns = ["findFirst", "findUnique", "findUniqueOrThrow", "update", "updateMany", "create", "count", "groupBy"] as const;
  const make = () => Object.fromEntries(fns.map((f) => [f, vi.fn()]));
  return {
    prisma: {
      bed: make(),
      admission: make(),
      ward: make(),
      wardTransfer: make(),
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
    permissions: ["MANAGE_ENCOUNTERS"],
  }),
  hasPermission: (access: { permissions: string[] }, permission: string) => access.permissions.includes(permission),
}));
vi.mock("@/lib/his/audit", () => ({ auditHis: vi.fn().mockResolvedValue(null) }));

import { NextRequest } from "next/server";
import { PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { auditHis } from "@/lib/his/audit";

const URL = "https://care.example/api/facility/his/beds/bed-1";

function makeCtx() {
  return { user: { id: "user-1" }, params: Promise.resolve({ id: "bed-1" }) } as never;
}

function patchRequest(body: unknown) {
  return new NextRequest(URL, { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(((fn: (tx: unknown) => unknown) => fn(prisma)) as never);
});

describe("PATCH /api/facility/his/beds/[id]", () => {
  it("reserves an AVAILABLE bed for an active admission", async () => {
    vi.mocked(prisma.bed.findFirst).mockResolvedValue({ id: "bed-1", status: "AVAILABLE", wardId: "ward-1" } as never);
    vi.mocked(prisma.admission.findFirst).mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } as never);
    vi.mocked(prisma.bed.update).mockResolvedValue({} as never);
    vi.mocked(prisma.bed.findUniqueOrThrow).mockResolvedValue({ id: "bed-1", label: "W1-01", status: "RESERVED" } as never);

    const res = await PATCH(patchRequest({ action: "RESERVE", admissionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), makeCtx());
    expect(res.status).toBe(200);
    expect(prisma.bed.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bed-1" },
        data: expect.objectContaining({ status: "RESERVED", reservedForAdmissionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
      }),
    );
    expect(auditHis).toHaveBeenCalled();
  });

  it("refuses to reserve without an admissionId", async () => {
    vi.mocked(prisma.bed.findFirst).mockResolvedValue({ id: "bed-1", status: "AVAILABLE", wardId: "ward-1" } as never);
    const res = await PATCH(patchRequest({ action: "RESERVE" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("refuses to reserve a bed that is not AVAILABLE", async () => {
    vi.mocked(prisma.bed.findFirst).mockResolvedValue({ id: "bed-1", status: "OCCUPIED", wardId: "ward-1" } as never);
    const res = await PATCH(patchRequest({ action: "RESERVE", admissionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), makeCtx());
    expect(res.status).toBe(409);
  });

  it("occupies a reserved bed, frees the previous bed and records the transfer", async () => {
    vi.mocked(prisma.bed.findFirst).mockResolvedValue({ id: "bed-1", status: "RESERVED", wardId: "ward-1" } as never);
    vi.mocked(prisma.admission.findFirst).mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", currentBedId: "bed-old", currentWardId: "ward-old" } as never);
    vi.mocked(prisma.ward.findUnique).mockImplementation((({ where }: { where: { id: string } }) =>
      Promise.resolve(({ "ward-old": { name: "Old Ward" }, "ward-1": { name: "New Ward" } })[where.id] ?? null)) as never);
    const updates: string[] = [];
    vi.mocked(prisma.bed.update).mockImplementation((({ data }: { data: { status?: string } }) => {
      updates.push(String(data.status));
      return Promise.resolve({} as never);
    }) as never);
    vi.mocked(prisma.admission.update).mockResolvedValue({} as never);
    vi.mocked(prisma.wardTransfer.create).mockResolvedValue({} as never);
    vi.mocked(prisma.bed.findUniqueOrThrow).mockResolvedValue({ id: "bed-1", label: "W1-01", status: "OCCUPIED" } as never);

    const res = await PATCH(patchRequest({ action: "OCCUPY", admissionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), makeCtx());
    expect(res.status).toBe(200);
    // previous bed freed to CLEANING, new bed OCCUPIED
    expect(updates).toContain("CLEANING");
    expect(updates).toContain("OCCUPIED");
    expect(prisma.wardTransfer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ admissionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", fromBedId: "bed-old", toBedId: "bed-1" }),
      }),
    );
    expect(prisma.admission.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentBedId: "bed-1", currentWardId: "ward-1" }) }),
    );
  });

  it("refuses to occupy a bed that is blocked or in cleaning", async () => {
    vi.mocked(prisma.bed.findFirst).mockResolvedValue({ id: "bed-1", status: "MAINTENANCE", wardId: "ward-1" } as never);
    vi.mocked(prisma.admission.findFirst).mockResolvedValue({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", currentBedId: null, currentWardId: null } as never);
    const res = await PATCH(patchRequest({ action: "OCCUPY", admissionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), makeCtx());
    expect(res.status).toBe(409);
  });

  it("releases an occupied bed to CLEANING on discharge", async () => {
    vi.mocked(prisma.bed.findFirst).mockResolvedValue({
      id: "bed-1",
      status: "OCCUPIED",
      wardId: "ward-1",
      currentAdmission: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "ACTIVE", patientId: "p1" },
    } as never);
    vi.mocked(prisma.admission.updateMany).mockResolvedValue(1 as never);
    vi.mocked(prisma.bed.update).mockResolvedValue({} as never);
    vi.mocked(prisma.bed.findUniqueOrThrow).mockResolvedValue({ id: "bed-1", label: "W1-01", status: "CLEANING" } as never);

    const res = await PATCH(patchRequest({ action: "RELEASE" }), makeCtx());
    expect(res.status).toBe(200);
    expect(prisma.bed.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bed-1" }, data: expect.objectContaining({ status: "CLEANING", currentAdmissionId: null }) }),
    );
    expect(prisma.admission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentBedId: null, currentWardId: null }) }),
    );
  });

  it("refuses to release a bed that is not occupied", async () => {
    vi.mocked(prisma.bed.findFirst).mockResolvedValue({ id: "bed-1", status: "AVAILABLE", wardId: "ward-1" } as never);
    const res = await PATCH(patchRequest({ action: "RELEASE" }), makeCtx());
    expect(res.status).toBe(409);
  });

  it("marks a CLEANING bed as AVAILABLE", async () => {
    vi.mocked(prisma.bed.findFirst).mockResolvedValue({ id: "bed-1", status: "CLEANING", wardId: "ward-1" } as never);
    vi.mocked(prisma.bed.update).mockResolvedValue({} as never);
    vi.mocked(prisma.bed.findUniqueOrThrow).mockResolvedValue({ id: "bed-1", label: "W1-01", status: "AVAILABLE" } as never);
    const res = await PATCH(patchRequest({ action: "MARK_CLEANED" }), makeCtx());
    expect(res.status).toBe(200);
    expect(prisma.bed.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bed-1" }, data: expect.objectContaining({ status: "AVAILABLE" }) }),
    );
  });

  it("blocks a free bed for maintenance and isolation, then unblocks it", async () => {
    vi.mocked(prisma.bed.findFirst).mockResolvedValue({ id: "bed-1", status: "AVAILABLE", wardId: "ward-1" } as never);
    vi.mocked(prisma.bed.update).mockResolvedValue({} as never);
    vi.mocked(prisma.bed.findUniqueOrThrow).mockResolvedValue({ id: "bed-1", label: "W1-01", status: "MAINTENANCE" } as never);

    let res = await PATCH(patchRequest({ action: "BLOCK_MAINTENANCE", reason: "Broken rail" }), makeCtx());
    expect(res.status).toBe(200);
    expect(prisma.bed.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bed-1" }, data: expect.objectContaining({ status: "MAINTENANCE", notes: "Broken rail" }) }),
    );

    res = await PATCH(patchRequest({ action: "BLOCK_ISOLATION" }), makeCtx());
    expect(res.status).toBe(200);
    expect(prisma.bed.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bed-1" }, data: expect.objectContaining({ status: "ISOLATION" }) }),
    );

    vi.mocked(prisma.bed.findFirst).mockResolvedValue({ id: "bed-1", status: "ISOLATION", wardId: "ward-1" } as never);
    vi.mocked(prisma.bed.findUniqueOrThrow).mockResolvedValue({ id: "bed-1", label: "W1-01", status: "AVAILABLE" } as never);
    res = await PATCH(patchRequest({ action: "UNBLOCK" }), makeCtx());
    expect(res.status).toBe(200);
    expect(prisma.bed.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bed-1" }, data: expect.objectContaining({ status: "AVAILABLE", isolationReason: null }) }),
    );
  });

  it("refuses to block an occupied bed", async () => {
    vi.mocked(prisma.bed.findFirst).mockResolvedValue({ id: "bed-1", status: "OCCUPIED", wardId: "ward-1" } as never);
    const res = await PATCH(patchRequest({ action: "BLOCK_MAINTENANCE" }), makeCtx());
    expect(res.status).toBe(409);
  });

  it("returns 404 for a bed belonging to another facility", async () => {
    vi.mocked(prisma.bed.findFirst).mockResolvedValue(null as never);
    const res = await PATCH(patchRequest({ action: "MARK_CLEANED" }), makeCtx());
    expect(res.status).toBe(404);
  });
});
