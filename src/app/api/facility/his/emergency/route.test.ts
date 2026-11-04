/**
 * Tests for the Emergency Department registration route
 * (POST /api/facility/his/emergency) and the live board (GET).
 * Existing patients are matched on case number + DOB; unidentified patients
 * get a flagged temporary record. Reconciliation moves clinical rows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const fns = ["findFirst", "findMany", "findUnique", "create", "update", "updateMany", "count", "groupBy"] as const;
  const make = () => Object.fromEntries(fns.map((f) => [f, vi.fn()]));
  return {
    prisma: {
      encounter: make(),
      patient: make(),
      bed: make(),
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
  findPatientByIdentity: vi.fn(),
}));
vi.mock("@/lib/his/audit", () => ({ auditHis: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/his/numbering", () => ({
  nextSequence: vi.fn().mockResolvedValue(7),
  formatNumber: (prefix: string, year: number, seq: number) => `${prefix}-${year}-${String(seq).padStart(6, "0")}`,
}));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { auditHis } from "@/lib/his/audit";
import { findPatientByIdentity } from "@/lib/his/access";

const URL = "https://care.example/api/facility/his/emergency";

function makeCtx() {
  return { user: { id: "user-1", role: "FACILITY" } } as never;
}

function postRequest(body: unknown) {
  return new NextRequest(URL, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(((fn: (tx: unknown) => unknown) => fn(prisma)) as never);
});

describe("POST /api/facility/his/emergency", () => {
  it("registers an existing patient matched on case number and date of birth", async () => {
    vi.mocked(findPatientByIdentity).mockResolvedValue({ id: "patient-1" } as never);
    vi.mocked(prisma.encounter.create).mockResolvedValue({
      id: "enc-1",
      encounterNumber: "ENC-2026-000007",
      status: "AWAITING_TRIAGE",
      patientId: "patient-1",
    } as never);

    const res = await POST(
      postRequest({ mode: "EXISTING", caseNumber: "CASE-000001", dateOfBirth: "1990-01-01", presentingComplaint: "Chest pain" }),
      makeCtx(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.encounter.id).toBe("enc-1");
    expect(findPatientByIdentity).toHaveBeenCalledWith("CASE-000001", "1990-01-01");
    expect(prisma.patient.create).not.toHaveBeenCalled();
    expect(prisma.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          facilityId: "facility-1",
          patientId: "patient-1",
          type: "EMERGENCY_DEPARTMENT",
          status: "AWAITING_TRIAGE",
          isEmergency: true,
          arrivalMode: "WALK_IN",
          chiefComplaint: "Chest pain",
        }),
      }),
    );
    expect(auditHis).toHaveBeenCalledWith(expect.anything(), "ED_PATIENT_REGISTERED", "Encounter", "enc-1", expect.anything(), expect.anything());
  });

  it("rejects an existing-patient registration without case number and DOB", async () => {
    const res = await POST(postRequest({ mode: "EXISTING" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 404 when no patient matches the identity", async () => {
    vi.mocked(findPatientByIdentity).mockResolvedValue(null as never);
    const res = await POST(postRequest({ mode: "EXISTING", caseNumber: "CASE-000001", dateOfBirth: "1990-01-01" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("creates a flagged temporary record for an unidentified patient", async () => {
    vi.mocked(prisma.patient.create).mockResolvedValue({ id: "temp-patient-1" } as never);
    vi.mocked(prisma.encounter.create).mockResolvedValue({
      id: "enc-2",
      encounterNumber: "ENC-2026-000007",
      status: "AWAITING_TRIAGE",
      patientId: "temp-patient-1",
    } as never);

    const res = await POST(
      postRequest({ mode: "UNIDENTIFIED", temporaryLabel: "John DOE #2", arrivalMode: "AMBULANCE", priority: "EMERGENCY" }),
      makeCtx(),
    );
    expect(res.status).toBe(201);
    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firstName: "Unidentified", lastName: "John DOE #2", unidentified: true }),
      }),
    );
    expect(prisma.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: "temp-patient-1",
          temporaryLabel: "John DOE #2",
          arrivalMode: "AMBULANCE",
          priority: "EMERGENCY",
        }),
      }),
    );
  });

  it("rejects an unidentified registration without a temporary label", async () => {
    const res = await POST(postRequest({ mode: "UNIDENTIFIED" }), makeCtx());
    expect(res.status).toBe(400);
  });

  it("rejects an invalid arrival mode", async () => {
    const res = await POST(postRequest({ mode: "UNIDENTIFIED", temporaryLabel: "Jane DOE", arrivalMode: "TELEPORT" }), makeCtx());
    expect(res.status).toBe(400);
  });
});

describe("GET /api/facility/his/emergency", () => {
  it("returns the live queue, KPIs and bed snapshot for active ED encounters", async () => {
    const now = new Date();
    vi.mocked(prisma.encounter.findMany).mockResolvedValue([
      {
        id: "enc-1",
        encounterNumber: "ENC-1",
        status: "AWAITING_TRIAGE",
        priority: "EMERGENCY",
        triageCategory: null,
        triagedAt: null,
        arrivalMode: "AMBULANCE",
        chiefComplaint: "Chest pain",
        clinicianName: null,
        department: "ED",
        reassessmentDueAt: null,
        temporaryLabel: null,
        registeredAt: new Date(now.getTime() - 30 * 60_000),
        patient: { id: "p1", caseNumber: "C1", firstName: "Ada", lastName: "Lovelace", unidentified: false, dateOfBirth: "1990-01-01" },
      },
      {
        id: "enc-2",
        encounterNumber: "ENC-2",
        status: "IN_PROGRESS",
        priority: "URGENT",
        triageCategory: "Urgent",
        triagedAt: now,
        arrivalMode: "WALK_IN",
        chiefComplaint: null,
        clinicianName: "Dr. House",
        department: "ED",
        reassessmentDueAt: new Date(now.getTime() - 5 * 60_000),
        temporaryLabel: "John DOE #2",
        registeredAt: new Date(now.getTime() - 120 * 60_000),
        patient: { id: "p2", caseNumber: "EDTEMP-1", firstName: "Unidentified", lastName: "John DOE #2", unidentified: true, dateOfBirth: "2000-01-01" },
      },
    ] as never);
    vi.mocked(prisma.bed.groupBy).mockResolvedValue([
      { status: "AVAILABLE", _count: { _all: 5 } },
      { status: "OCCUPIED", _count: { _all: 3 } },
    ] as never);
    vi.mocked(prisma.encounter.count).mockResolvedValue(2 as never);

    const res = await GET(new NextRequest(URL), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.queue).toHaveLength(2);
    expect(body.kpis.active).toBe(2);
    expect(body.kpis.critical).toBe(1);
    expect(body.kpis.awaitingTriage).toBe(1);
    expect(body.kpis.overdueReassessment).toBe(1);
    expect(body.kpis.ambulanceLastHour).toBe(2);
    expect(body.beds).toMatchObject({ available: 5, occupied: 3, reserved: 0, cleaning: 0, maintenance: 0, isolation: 0 });
    // the unidentified temporary patient is clearly labelled on the board
    expect(body.queue.find((e: { id: string }) => e.id === "enc-2").temporaryLabel).toBe("John DOE #2");
  });
});
