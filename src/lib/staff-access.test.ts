/**
 * Tests for staff patient-level access control (src/lib/staff-access.ts).
 * Covers: LIMITED reach, explicit grants, break-glass grants, EXTENDED
 * department scoping, care-relationship fallback and break-glass validation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => {
  const fns = ["findFirst", "findMany", "create", "update"] as const;
  const make = () => Object.fromEntries(fns.map((f) => [f, vi.fn()]));
  return {
    prisma: {
      facilityStaff: make(),
      breakGlassAccess: make(),
      staffPatientAccess: make(),
      encounter: make(),
      admission: make(),
      facilityBooking: make(),
      labOrder: make(),
      payerCoverage: make(),
      clinicalDocument: make(),
      patientAssignment: make(),
      facilityDepartment: make(),
      auditLog: make(),
    },
  };
});

import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getStaffMembership,
  hasActiveBreakGlass,
  assertStaffCanReachPatient,
  createBreakGlassAccess,
  closeBreakGlassAccess,
  type StaffMembershipInfo,
} from "./staff-access";

const USER = { id: "user-1", role: "FACILITY", status: "ACTIVE" } as unknown as User;

const membership = (over: Partial<StaffMembershipInfo> = {}): StaffMembershipInfo => ({
  staffId: "staff-1",
  facilityId: "facility-1",
  accessLevel: "STANDARD",
  departmentIds: [],
  ...over,
});

const noRow = { select: { id: true } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getStaffMembership", () => {
  it("returns the active membership with departments", async () => {
    vi.mocked(prisma.facilityStaff.findFirst).mockResolvedValue({
      id: "staff-1",
      accessLevel: "EXTENDED",
      departmentIds: ["dept-1"],
    } as never);
    const info = await getStaffMembership(USER, "facility-1");
    expect(info).toEqual({ staffId: "staff-1", facilityId: "facility-1", accessLevel: "EXTENDED", departmentIds: ["dept-1"] });
  });

  it("rejects staff with no active membership", async () => {
    vi.mocked(prisma.facilityStaff.findFirst).mockResolvedValue(null as never);
    await expect(getStaffMembership(USER, "facility-1")).rejects.toMatchObject({ status: 403 });
  });
});

describe("assertStaffCanReachPatient", () => {
  it("allows LIMITED staff only with an explicit patient grant", async () => {
    vi.mocked(prisma.staffPatientAccess.findFirst).mockResolvedValue({ id: "grant-1" } as never);
    await expect(assertStaffCanReachPatient(membership({ accessLevel: "LIMITED" }), "patient-1")).resolves.toBeUndefined();
  });

  it("allows LIMITED staff with an active break-glass grant", async () => {
    vi.mocked(prisma.staffPatientAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue({ id: "bg-1" } as never);
    await expect(assertStaffCanReachPatient(membership({ accessLevel: "LIMITED" }), "patient-1")).resolves.toBeUndefined();
  });

  it("blocks LIMITED staff without any grant, even for facility patients", async () => {
    vi.mocked(prisma.staffPatientAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.encounter.findFirst).mockResolvedValue({ id: "enc-1" } as never);
    await expect(assertStaffCanReachPatient(membership({ accessLevel: "LIMITED" }), "patient-1")).rejects.toMatchObject({ status: 404 });
  });

  it("allows STANDARD staff for any patient with a care relationship at the facility", async () => {
    vi.mocked(prisma.staffPatientAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.encounter.findFirst).mockResolvedValue({ id: "enc-1" } as never);
    // remaining relationship probes return null
    for (const model of ["admission", "facilityBooking", "labOrder", "payerCoverage", "clinicalDocument", "patientAssignment"] as const) {
      vi.mocked(prisma[model].findFirst).mockResolvedValue(null as never);
    }
    await expect(assertStaffCanReachPatient(membership(), "patient-1")).resolves.toBeUndefined();
  });

  it("blocks STANDARD staff for patients with no care relationship at the facility", async () => {
    vi.mocked(prisma.staffPatientAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue(null as never);
    for (const model of ["encounter", "admission", "facilityBooking", "labOrder", "payerCoverage", "clinicalDocument", "patientAssignment"] as const) {
      vi.mocked(prisma[model].findFirst).mockResolvedValue(null as never);
    }
    await expect(assertStaffCanReachPatient(membership(), "patient-1")).rejects.toMatchObject({ status: 404 });
  });

  it("allows EXTENDED staff via an active admission in their department set", async () => {
    vi.mocked(prisma.staffPatientAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.facilityDepartment.findFirst).mockResolvedValue({ id: "dept-1" } as never);
    vi.mocked(prisma.admission.findFirst).mockResolvedValue({ id: "adm-1" } as never);
    await expect(
      assertStaffCanReachPatient(membership({ accessLevel: "EXTENDED", departmentIds: ["dept-1"] }), "patient-1"),
    ).resolves.toBeUndefined();
  });

  it("ignores departments for EXTENDED staff with no departments assigned", async () => {
    vi.mocked(prisma.staffPatientAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.facilityDepartment.findFirst).mockResolvedValue({ id: "dept-1" } as never);
    vi.mocked(prisma.encounter.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.admission.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.facilityBooking.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.labOrder.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.payerCoverage.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.clinicalDocument.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.patientAssignment.findFirst).mockResolvedValue(null as never);
    await expect(
      assertStaffCanReachPatient(membership({ accessLevel: "EXTENDED", departmentIds: [] }), "patient-1"),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.facilityDepartment.findFirst).not.toHaveBeenCalled();
  });
});

describe("hasActiveBreakGlass", () => {
  it("requires an open, unexpired grant", async () => {
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue({ id: "bg-1" } as never);
    expect(await hasActiveBreakGlass("facility-1", "staff-1", "patient-1")).toBe(true);
    const where = vi.mocked(prisma.breakGlassAccess.findFirst).mock.calls[0][0]?.where;
    expect(where).toMatchObject({ facilityId: "facility-1", staffId: "staff-1", patientId: "patient-1", closedAt: null });
    expect(JSON.stringify(where)).toContain("expiresAt");
  });

  it("is false without a grant", async () => {
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue(null as never);
    expect(await hasActiveBreakGlass("facility-1", "staff-1", "patient-1")).toBe(false);
  });
});

describe("createBreakGlassAccess", () => {
  it("rejects a short justification", async () => {
    await expect(createBreakGlassAccess(membership(), "patient-1", "too short")).rejects.toMatchObject({ status: 400 });
    expect(prisma.breakGlassAccess.create).not.toHaveBeenCalled();
  });

  it("rejects out-of-range durations", async () => {
    await expect(createBreakGlassAccess(membership(), "patient-1", "Emergency access for urgent resuscitation", 0)).rejects.toMatchObject({ status: 400 });
    await expect(createBreakGlassAccess(membership(), "patient-1", "Emergency access for urgent resuscitation", 481)).rejects.toMatchObject({ status: 400 });
    expect(prisma.breakGlassAccess.create).not.toHaveBeenCalled();
  });

  it("rejects patients with no care relationship and no grant", async () => {
    vi.mocked(prisma.staffPatientAccess.findFirst).mockResolvedValue(null as never);
    for (const model of ["encounter", "admission", "facilityBooking", "labOrder", "payerCoverage", "clinicalDocument", "patientAssignment"] as const) {
      vi.mocked(prisma[model].findFirst).mockResolvedValue(null as never);
    }
    await expect(createBreakGlassAccess(membership(), "patient-1", "Emergency access for urgent resuscitation")).rejects.toMatchObject({ status: 404 });
  });

  it("creates a grant and writes an audit log entry", async () => {
    vi.mocked(prisma.staffPatientAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.encounter.findFirst).mockResolvedValue({ id: "enc-1" } as never);
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.breakGlassAccess.create).mockResolvedValue({ id: "bg-1", expiresAt: new Date() } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const grant = await createBreakGlassAccess(membership(), "patient-1", "Emergency access for urgent resuscitation", 60);
    expect(grant.id).toBe("bg-1");
    expect(prisma.breakGlassAccess.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          facilityId: "facility-1",
          staffId: "staff-1",
          patientId: "patient-1",
          justification: "Emergency access for urgent resuscitation",
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "BREAK_GLASS_ACCESS_GRANTED", outcome: "SUCCESS" }),
      }),
    );
  });

  it("reuses an existing open grant instead of creating a second one", async () => {
    vi.mocked(prisma.staffPatientAccess.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.encounter.findFirst).mockResolvedValue({ id: "enc-1" } as never);
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue({ id: "bg-existing", expiresAt: new Date() } as never);
    const grant = await createBreakGlassAccess(membership(), "patient-1", "Emergency access for urgent resuscitation");
    expect(grant.id).toBe("bg-existing");
    expect(prisma.breakGlassAccess.create).not.toHaveBeenCalled();
  });
});

describe("closeBreakGlassAccess", () => {
  it("closes the grant and audits the closure", async () => {
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue({ id: "bg-1" } as never);
    vi.mocked(prisma.breakGlassAccess.update).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
    await closeBreakGlassAccess(membership(), "bg-1", "care handed over");
    expect(prisma.breakGlassAccess.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "bg-1" }, data: expect.objectContaining({ closedAt: expect.any(Date) }) }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "BREAK_GLASS_ACCESS_CLOSED" }) }),
    );
  });

  it("rejects grants from another facility", async () => {
    vi.mocked(prisma.breakGlassAccess.findFirst).mockResolvedValue(null as never);
    await expect(closeBreakGlassAccess(membership(), "bg-1", "reason")).rejects.toMatchObject({ status: 404 });
  });
});

// keep the noRow reference used (select shape check helper)
void noRow;
