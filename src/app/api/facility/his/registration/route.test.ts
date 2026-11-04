/**
 * Tests for the registration workspace API
 * (GET/POST /api/facility/his/registration).
 *
 * Covers the mandatory acceptance scenarios that are testable at the route
 * level: existing-patient registration without duplication, the duplicate
 * review gate before new-patient creation, emergency temporary records,
 * guardian requirements for minors, consent policy and draft completion.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const fns = ["findFirst", "findMany", "findUnique", "create", "update", "updateMany", "count", "groupBy"] as const;
  const make = () => Object.fromEntries(fns.map((f) => [f, vi.fn()]));
  return {
    prisma: {
      encounter: make(),
      patient: make(),
      admission: make(),
      payerCoverage: make(),
      registrationDraft: make(),
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
    user: { id: "user-1", name: "Test User" },
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
vi.mock("@/lib/case-number", () => ({ generateCaseNumber: () => "MC-TESTCODE" }));
vi.mock("@/lib/his/registration", async () => {
  const actual = await vi.importActual("@/lib/his/registration");
  return { ...(actual as Record<string, unknown>), findPotentialDuplicates: vi.fn() };
});

import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { findPatientByIdentity } from "@/lib/his/access";
import { findPotentialDuplicates } from "@/lib/his/registration";
import { auditHis } from "@/lib/his/audit";
import { CONSENT_CATALOGUE } from "@/lib/his/registration";

const URL = "https://care.example/api/facility/his/registration";

function makeCtx() {
  return { user: { id: "user-1", name: "Test User", role: "FACILITY" } } as never;
}
function postRequest(body: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return new NextRequest(URL, { method: "POST", body: JSON.stringify({ ...body, ...extra }), headers: { "content-type": "application/json" } });
}
function consentsFor(keys: string[]) {
  return CONSENT_CATALOGUE.filter((c) => keys.includes(c.key)).map((c) => ({
    key: c.key, title: c.title, version: c.version, status: "GIVEN", signedByRole: "PATIENT",
  }));
}
const REQUIRED = ["general_admission", "privacy_notice", "financial_responsibility"];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation(((fn: (tx: unknown) => unknown) => fn(prisma)) as never);
  vi.mocked(findPotentialDuplicates).mockResolvedValue([]);
  vi.mocked(prisma.registrationDraft.update).mockResolvedValue({ id: "d1" } as never);
  vi.mocked(prisma.registrationDraft.findMany).mockResolvedValue([]);
  vi.mocked(prisma.encounter.count).mockResolvedValue(0);
});

describe("POST /api/facility/his/registration", () => {
  const base = (patient: unknown, extra: Record<string, unknown> = {}) => ({
    admissionType: "OUTPATIENT",
    patient,
    consents: consentsFor(REQUIRED),
    ...extra,
  });

  it("registers an existing patient without creating a duplicate record", async () => {
    vi.mocked(findPatientByIdentity).mockResolvedValue({ id: "patient-1" } as never);
    vi.mocked(prisma.encounter.create).mockResolvedValue({
      id: "enc-1", encounterNumber: "ENC-2026-000007", status: "REGISTERED", patientId: "patient-1",
    } as never);

    const res = await POST(
      postRequest(base({ mode: "EXISTING", caseNumber: "MC-TEST0001", dateOfBirth: "1990-04-12" })),
      makeCtx(),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.encounter.encounterNumber).toBe("ENC-2026-000007");
    expect(prisma.patient.create).not.toHaveBeenCalled();
    expect(auditHis).toHaveBeenCalledWith(expect.anything(), "REGISTRATION_COMPLETED", "Encounter", "enc-1", expect.anything(), expect.anything());
  });

  it("blocks a new patient while possible duplicates are unreviewed (409)", async () => {
    vi.mocked(findPotentialDuplicates).mockResolvedValue([
      { id: "123e4567-e89b-42d3-a456-426614174001", caseNumber: "MC-DUP", firstName: "Ada", lastName: "Obi", score: 0.8, reasons: ["Same date of birth"] },
    ] as never);

    const res = await POST(
      postRequest(base({
        mode: "NEW",
        data: { firstName: "Ada", lastName: "Obi", dateOfBirth: "1990-04-12", gender: "FEMALE" },
      })),
      makeCtx(),
    );
    expect(res.status).toBe(409);
    expect(prisma.patient.create).not.toHaveBeenCalled();
  });

  it("creates a new patient after duplicates were reviewed and acknowledged", async () => {
    vi.mocked(findPotentialDuplicates).mockResolvedValue([
      { id: "123e4567-e89b-42d3-a456-426614174001", caseNumber: "MC-DUP", firstName: "Ada", lastName: "Obi", score: 0.8, reasons: ["Same date of birth"] },
    ] as never);
    vi.mocked(prisma.patient.create).mockResolvedValue({ id: "patient-2", caseNumber: "MC-TESTCODE" } as never);
    vi.mocked(prisma.encounter.create).mockResolvedValue({
      id: "enc-2", encounterNumber: "ENC-2026-000008", status: "REGISTERED", patientId: "patient-2",
    } as never);

    const res = await POST(
      postRequest(base({
        mode: "NEW",
        acknowledgedDuplicateIds: ["123e4567-e89b-42d3-a456-426614174001"],
        data: { firstName: "Ada", lastName: "Obi", dateOfBirth: "1990-04-12", gender: "FEMALE" },
      })),
      makeCtx(),
    );
    expect(res.status).toBe(201);
    expect(prisma.patient.create).toHaveBeenCalledTimes(1);
  });

  it("requires guardian details for minors (non-emergency)", async () => {
    const res = await POST(
      postRequest(base({
        mode: "NEW",
        data: { firstName: "Chidi", lastName: "Obi", dateOfBirth: "2015-06-01", gender: "MALE" },
      })),
      makeCtx(),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("Guardian") });
  });

  it("registers a temporary emergency record with a provisional identity", async () => {
    vi.mocked(prisma.patient.create).mockResolvedValue({ id: "temp-1" } as never);
    vi.mocked(prisma.encounter.create).mockResolvedValue({
      id: "enc-3", encounterNumber: "ENC-2026-000009", status: "AWAITING_TRIAGE", patientId: "temp-1",
    } as never);

    const res = await POST(
      postRequest(
        { patient: { mode: "TEMPORARY", temporaryLabel: "Male, red jacket" } },
        { admissionType: "EMERGENCY_DEPARTMENT", emergency: true, assessment: { presentingComplaint: "RTA, unconscious" }, consents: consentsFor(["privacy_notice", "financial_responsibility"]) },
      ),
      makeCtx(),
    );
    expect(res.status).toBe(201);
    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ unidentified: true, firstName: "Unidentified" }) }),
    );
    expect(prisma.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "AWAITING_TRIAGE", isEmergency: true }) }),
    );
  });

  it("rejects routine registrations missing mandatory consents", async () => {
    const res = await POST(
      postRequest(base({ mode: "EXISTING", caseNumber: "MC-TEST0001", dateOfBirth: "1990-04-12" }, { consents: [] })),
      makeCtx(),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("consent") });
  });

  it("creates an admission and links it to the encounter for inpatient types", async () => {
    vi.mocked(findPatientByIdentity).mockResolvedValue({ id: "patient-1" } as never);
    vi.mocked(prisma.admission.create).mockResolvedValue({ id: "adm-1" } as never);
    vi.mocked(prisma.encounter.create).mockResolvedValue({
      id: "enc-4", encounterNumber: "ENC-2026-000010", status: "REGISTERED", patientId: "patient-1",
    } as never);

    const res = await POST(
      postRequest(
        base({ mode: "EXISTING", caseNumber: "MC-TEST0001", dateOfBirth: "1990-04-12" }),
        { admissionType: "INPATIENT_PLANNED", reasonForAdmission: "Elective surgery" },
      ),
      makeCtx(),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.admissionNumber).toMatch(/^ADM-/);
    expect(prisma.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ admissionId: "adm-1" }) }),
    );
  });

  it("records insurance coverage starting NOT_VERIFIED (never assumed)", async () => {
    vi.mocked(findPatientByIdentity).mockResolvedValue({ id: "patient-1" } as never);
    vi.mocked(prisma.payerCoverage.create).mockResolvedValue({ id: "cov-1" } as never);
    vi.mocked(prisma.encounter.create).mockResolvedValue({
      id: "enc-5", encounterNumber: "ENC-2026-000011", status: "REGISTERED", patientId: "patient-1",
    } as never);

    const res = await POST(
      postRequest(
        base({ mode: "EXISTING", caseNumber: "MC-TEST0001", dateOfBirth: "1990-04-12" }),
        { coverage: { category: "PRIVATE_INSURANCE", providerName: "Acme Health" } },
      ),
      makeCtx(),
    );
    expect(res.status).toBe(201);
    expect(prisma.payerCoverage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eligibility: "NOT_VERIFIED", providerName: "Acme Health" }) }),
    );
    expect(prisma.encounter.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ coverageId: "cov-1", payerCategory: "PRIVATE_INSURANCE" }) }),
    );
  });

  it("marks a completed draft and links the produced records", async () => {
    vi.mocked(findPatientByIdentity).mockResolvedValue({ id: "patient-1" } as never);
    vi.mocked(prisma.encounter.create).mockResolvedValue({
      id: "enc-6", encounterNumber: "ENC-2026-000012", status: "REGISTERED", patientId: "patient-1",
    } as never);

    const res = await POST(
      postRequest(
        base({ mode: "EXISTING", caseNumber: "MC-TEST0001", dateOfBirth: "1990-04-12" }),
        { draftId: "123e4567-e89b-42d3-a456-426614174000" },
      ),
      makeCtx(),
    );
    expect(res.status).toBe(201);
    expect(prisma.registrationDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "123e4567-e89b-42d3-a456-426614174000", facilityId: "facility-1", status: "DRAFT" },
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
  });
});

describe("GET /api/facility/his/registration", () => {
  it("returns the admission dashboard counters", async () => {
    vi.mocked(prisma.encounter.findMany)
      .mockResolvedValueOnce([{ patientId: "p1", status: "REGISTERED", type: "UNSCHEDULED_OUTPATIENT", priority: "ROUTINE", isEmergency: false, consents: [] }] as never)
      .mockResolvedValueOnce([]);
    vi.mocked(prisma.patient.findMany).mockResolvedValue([{ id: "p1", createdAt: new Date() }] as never);
    vi.mocked(prisma.admission.count).mockResolvedValue(3);
    vi.mocked(prisma.registrationDraft.findMany).mockResolvedValue([]);
    vi.mocked(prisma.encounter.count).mockResolvedValue(1);

    const res = await GET(new NextRequest(URL, { method: "GET" }), makeCtx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.today.registrations).toBe(1);
    expect(json.today.newPatients).toBe(1);
    expect(json.activeAdmissions).toBe(3);
  });
});
