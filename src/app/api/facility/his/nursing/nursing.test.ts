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
    nursingObservation: { findMany: vi.fn(), create: vi.fn() },
    nursingTask: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    nursingHandover: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { requireUser } from "@/lib/auth";
import { requireHisAccess, assertPatientLinked } from "@/lib/his/access";
import { prisma } from "@/lib/prisma";
import { POST as createObservation, GET as listObservations } from "./observations/route";
import { POST as createTask, GET as listTasks } from "./tasks/route";
import { PATCH as patchTask } from "./tasks/[id]/route";
import { POST as createHandover, GET as listHandovers } from "./handover/route";

const PATIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TASK_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TASK_B = "dedddddd-dddd-4ddd-8ddd-ddddddddddde";
const TASK_C = "dfdddddd-dddd-4ddd-8ddd-dddddddddddf";
const TASK_UNKNOWN = "d0dddddd-dddd-4ddd-8ddd-ddddddddddd0";
const TAKEN_AT = "2026-10-30T08:00:00Z"; // safely in the past
const json = (method: string, path: string, body?: unknown) => new NextRequest(`http://localhost:3000${path}`, {
  method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue({ id: "nurse-1", role: "NURSE", status: "ACTIVE", onboardingComplete: true, deletedAt: null } as never);
  vi.mocked(requireHisAccess).mockResolvedValue({ facility: { id: "hospital-a" }, user: { id: "nurse-1", role: "NURSE" }, permissions: ["RECORD_NURSING", "VIEW_PATIENT_DOCUMENTS"] } as never);
  vi.mocked(assertPatientLinked).mockResolvedValue(undefined);
});

describe("nursing observations", () => {
  it("records an observation with the registry unit, author and clinical timestamp", async () => {
    vi.mocked(prisma.nursingObservation.create).mockResolvedValue({ id: "obs-1" } as never);
    const res = await createObservation(json("POST", "/api/facility/his/nursing/observations", {
      patientId: PATIENT, observationType: "TEMPERATURE", value: "36.8", recordedAt: TAKEN_AT,
    }), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.observation).toMatchObject({ id: "obs-1" });
    const created = vi.mocked(prisma.nursingObservation.create).mock.calls[0]![0].data;
    expect(created).toMatchObject({ observationType: "TEMPERATURE", value: "36.8", unit: "°C", recordedById: "nurse-1", patientId: PATIENT });
    expect(created.recordedAt).toEqual(new Date(TAKEN_AT));
    expect(data.availableTypes).toHaveLength(11);
  });

  it("defaults the timestamp to now when not supplied", async () => {
    vi.mocked(prisma.nursingObservation.create).mockResolvedValue({ id: "obs-2" } as never);
    const before = Date.now();
    await createObservation(json("POST", "/api/facility/his/nursing/observations", {
      patientId: PATIENT, observationType: "PULSE", value: "72",
    }), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({}) } as never);
    const created = vi.mocked(prisma.nursingObservation.create).mock.calls[0]![0].data;
    expect((created.recordedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("rejects malformed values without inventing clinical thresholds", async () => {
    const res = await createObservation(json("POST", "/api/facility/his/nursing/observations", {
      patientId: PATIENT, observationType: "BLOOD_PRESSURE", value: "120",
    }), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(400);
    const res2 = await createObservation(json("POST", "/api/facility/his/nursing/observations", {
      patientId: PATIENT, observationType: "NOT_A_TYPE", value: "1",
    }), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({}) } as never);
    expect(res2.status).toBe(400);
  });

  it("lists a patient's observation log", async () => {
    vi.mocked(prisma.nursingObservation.findMany).mockResolvedValue([{ id: "obs-1", observationType: "PULSE" }] as never);
    const res = await listObservations(new NextRequest(`http://localhost:3000/api/facility/his/nursing/observations?patientId=${PATIENT}`), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    expect((await res.json()).observations).toHaveLength(1);
    expect(assertPatientLinked).toHaveBeenCalledWith("hospital-a", PATIENT);
  });
});

describe("care tasks", () => {
  it("creates a task that starts as due", async () => {
    vi.mocked(prisma.nursingTask.create).mockResolvedValue({ id: TASK_A } as never);
    const res = await createTask(json("POST", "/api/facility/his/nursing/tasks", {
      patientId: PATIENT, title: "Hourly turning", dueAt: "2026-10-31T12:00:00Z",
    }), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(201);
    const created = vi.mocked(prisma.nursingTask.create).mock.calls[0]![0].data;
    expect(created).toMatchObject({ title: "Hourly turning", status: "DUE", createdById: "nurse-1" });
  });

  it("completes a task and stamps the completion time", async () => {
    vi.mocked(prisma.nursingTask.findFirst).mockResolvedValue({ id: TASK_A, status: "IN_PROGRESS", patientId: PATIENT, assignedToId: "nurse-1" } as never);
    vi.mocked(prisma.nursingTask.update).mockResolvedValue({ id: TASK_A, status: "COMPLETED" } as never);
    const res = await patchTask(json("PATCH", `/api/facility/his/nursing/tasks/${TASK_A}`, { status: "COMPLETED" }), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({ id: TASK_A }) } as never);
    expect(res.status).toBe(200);
    const updated = vi.mocked(prisma.nursingTask.update).mock.calls[0]![0].data;
    expect(updated.status).toBe("COMPLETED");
    expect(updated.completedAt).toBeInstanceOf(Date);
  });

  it("rejects transitions outside the lifecycle", async () => {
    vi.mocked(prisma.nursingTask.findFirst).mockResolvedValue({ id: TASK_A, status: "COMPLETED", patientId: PATIENT } as never);
    const res = await patchTask(json("PATCH", `/api/facility/his/nursing/tasks/${TASK_A}`, { status: "DUE" }), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({ id: TASK_A }) } as never);
    expect(res.status).toBe(409);
    const res2 = await patchTask(json("PATCH", `/api/facility/his/nursing/tasks/${TASK_A}`, { status: "COMPLETED" }), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({ id: TASK_A }) } as never);
    expect(res2.status).toBe(409);
  });

  it("returns the ward worklist scoped to the facility", async () => {
    vi.mocked(prisma.nursingTask.findMany).mockResolvedValue([] as never);
    const res = await listTasks(new NextRequest("http://localhost:3000/api/facility/his/nursing/tasks"), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.nursingTask.findMany).mock.calls[0]![0]!.where;
    expect(where).toMatchObject({ facilityId: "hospital-a" });
  });
});

describe("handover", () => {
  it("records a handover and attaches only this patient's open tasks", async () => {
    vi.mocked(prisma.nursingTask.findMany).mockResolvedValue([{ id: TASK_A }, { id: TASK_B }, { id: TASK_C }] as never);
    vi.mocked(prisma.nursingHandover.create).mockResolvedValue({ id: "h-1" } as never);
    const res = await createHandover(json("POST", "/api/facility/his/nursing/handover", {
      patientId: PATIENT, summary: "Stable, watch fluids", openTaskIds: [TASK_A, TASK_B, TASK_UNKNOWN],
    }), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(201);
    const created = vi.mocked(prisma.nursingHandover.create).mock.calls[0]![0].data;
    expect(created.fromUserId).toBe("nurse-1");
    expect(created.openTaskIds).toEqual([TASK_A, TASK_B]);
  });

  it("lists handovers for the patient chart", async () => {
    vi.mocked(prisma.nursingHandover.findMany).mockResolvedValue([] as never);
    const res = await listHandovers(new NextRequest(`http://localhost:3000/api/facility/his/nursing/handover?patientId=${PATIENT}`), { user: { id: "nurse-1", role: "NURSE" }, params: Promise.resolve({}) } as never);
    expect(res.status).toBe(200);
  });
});
