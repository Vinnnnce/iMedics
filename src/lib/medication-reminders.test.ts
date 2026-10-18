import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Medication reminder tests with a mocked Prisma client.
 * Critical rules: opening a notification only ACKNOWLEDGES a dose — it never
 * marks it TAKEN — and only a human (or the scheduler after the grace window)
 * changes the status.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    doseEvent: {
      findUnique: vi.fn(),
      update: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("@/lib/notifications/service", () => ({
  notifyUser: vi.fn(),
  notifyUsers: vi.fn(),
}));

import { materialiseDoseEvents, recordDoseStatus, adherenceSummary, ensureReminderForPrescriptionItem } from "./medication-reminders";
import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, { partial: true }) as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

function resetMocks() {
  for (const model of Object.values(mockPrisma)) for (const fn of Object.values(model)) fn.mockReset();
}

const reminder = {
  id: "reminder-1",
  patientId: "patient-1",
  times: ["08:00", "20:00"],
  startDate: new Date("2026-10-01T00:00:00Z"),
  endDate: null,
  active: true,
};

beforeEach(resetMocks);

describe("recordDoseStatus", () => {
  const dose = {
    id: "dose-1",
    status: "SCHEDULED",
    acknowledgedAt: null,
    recordedAt: null,
    recordedById: null,
    recordedVia: null,
  };

  it("marks a dose TAKEN when the patient records it", async () => {
    mockPrisma.doseEvent.findUnique.mockResolvedValue(dose);
    mockPrisma.doseEvent.update.mockResolvedValue({ ...dose, status: "TAKEN" });
    const result = await recordDoseStatus("dose-1", "TAKEN", "user-1", "PATIENT");
    expect(result.status).toBe("TAKEN");
    expect(mockPrisma.doseEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "TAKEN", recordedVia: "PATIENT" }),
      }),
    );
  });

  it("only acknowledges (never takes) when the patient opens the reminder", async () => {
    mockPrisma.doseEvent.findUnique.mockResolvedValue(dose);
    mockPrisma.doseEvent.update.mockResolvedValue({ ...dose, status: "ACKNOWLEDGED" });
    const result = await recordDoseStatus("dose-1", "ACKNOWLEDGED", "user-1", "PATIENT");
    expect(result.status).toBe("ACKNOWLEDGED");
    // recordedAt must stay untouched: acknowledgement is not a dose record.
    expect(mockPrisma.doseEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACKNOWLEDGED", recordedAt: null }),
      }),
    );
  });

  it("preserves an earlier acknowledgement when the dose is later taken", async () => {
    const acknowledged = { ...dose, status: "ACKNOWLEDGED", acknowledgedAt: new Date("2026-10-18T07:00:00Z") };
    mockPrisma.doseEvent.findUnique.mockResolvedValue(acknowledged);
    mockPrisma.doseEvent.update.mockResolvedValue({ ...acknowledged, status: "TAKEN" });
    await recordDoseStatus("dose-1", "TAKEN", "user-1", "PATIENT");
    expect(mockPrisma.doseEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ acknowledgedAt: acknowledged.acknowledgedAt }),
      }),
    );
  });

  it("throws 404 for an unknown dose", async () => {
    mockPrisma.doseEvent.findUnique.mockResolvedValue(null);
    await expect(recordDoseStatus("missing", "TAKEN", "user-1")).rejects.toMatchObject({ status: 404 });
  });

  it("refuses to downgrade a recorded outcome back to acknowledged (409)", async () => {
    const taken = { ...dose, status: "TAKEN", recordedAt: new Date("2026-10-18T08:05:00Z") };
    mockPrisma.doseEvent.findUnique.mockResolvedValue(taken);
    // A late acknowledgement (e.g. the patient re-opened the notification)
    // must never overwrite the explicit TAKEN record.
    await expect(recordDoseStatus("dose-1", "ACKNOWLEDGED", "user-1")).rejects.toMatchObject({ status: 409 });
    expect(mockPrisma.doseEvent.update).not.toHaveBeenCalled();
  });
});

describe("materialiseDoseEvents", () => {
  it("creates one dose event per scheduled time inside the window", async () => {
    mockPrisma.doseEvent.createMany.mockResolvedValue({ count: 1 });
    const created = await materialiseDoseEvents(reminder, new Date("2026-10-18T00:00:00Z"), new Date("2026-10-18T23:59:00Z"));
    expect(created).toBe(2);
    expect(mockPrisma.doseEvent.createMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.doseEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reminderId: "reminder-1", patientId: "patient-1" }), skipDuplicates: true }),
    );
  });

  it("creates nothing for an inactive reminder or an empty schedule", async () => {
    expect(await materialiseDoseEvents({ ...reminder, active: false }, new Date(), new Date())).toBe(0);
    expect(await materialiseDoseEvents({ ...reminder, times: [] }, new Date(), new Date())).toBe(0);
    expect(mockPrisma.doseEvent.createMany).not.toHaveBeenCalled();
  });

  it("never materialises doses beyond the reminder's end date", async () => {
    mockPrisma.doseEvent.createMany.mockResolvedValue({ count: 0 });
    // Reminder ended mid-window: the 20:00 dose on the final day is in range,
    // but the next day's doses must not be created.
    const ended = { ...reminder, endDate: new Date("2026-10-18T23:59:00Z") };
    await materialiseDoseEvents(ended, new Date("2026-10-18T00:00:00Z"), new Date("2026-10-19T23:59:00Z"));
    const scheduled = mockPrisma.doseEvent.createMany.mock.calls.map(
      (c: Array<{ data: { scheduledFor: Date } }>) => c[0].data.scheduledFor.getTime(),
    );
    expect(scheduled.length).toBeGreaterThan(0);
    expect(scheduled.every((t: number) => t <= ended.endDate!.getTime())).toBe(true);
  });
});

describe("adherenceSummary", () => {
  it("aggregates dose statuses over the window", async () => {
    mockPrisma.doseEvent.groupBy.mockResolvedValue([
      { status: "TAKEN", _count: { _all: 8 } },
      { status: "MISSED", _count: { _all: 2 } },
    ]);
    const summary = await adherenceSummary("patient-1", 30);
    expect(summary).toMatchObject({ total: 10, taken: 8, missed: 2, skipped: 0 });
  });
});

describe("ensureReminderForPrescriptionItem", () => {
  it("creates a reminder from a prescription item's schedule (idempotent upsert)", async () => {
    mockPrisma.prescriptionItem = { findUnique: vi.fn() } as never;
    mockPrisma.medicationReminder = { upsert: vi.fn() } as never;
    (mockPrisma.prescriptionItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "item-1",
      drugName: "Paracetamol",
      schedule: ["08:00", "22:00"],
      startDate: new Date("2026-10-18T00:00:00Z"),
      endDate: null,
      prescription: { patientId: "patient-1" },
    });
    mockPrisma.medicationReminder.upsert.mockResolvedValue({ id: "reminder-9" });
    const reminderCreated = await ensureReminderForPrescriptionItem("item-1", "doctor-user-1");
    expect(reminderCreated).toMatchObject({ id: "reminder-9" });
    expect(mockPrisma.medicationReminder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { prescriptionItemId: "item-1" },
        create: expect.objectContaining({ times: ["08:00", "22:00"], label: "Paracetamol" }),
      }),
    );
  });

  it("skips items without a usable schedule", async () => {
    mockPrisma.prescriptionItem = { findUnique: vi.fn() } as never;
    (mockPrisma.prescriptionItem.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "item-2",
      drugName: "PRN cream",
      schedule: [],
      prescription: { patientId: "patient-1" },
    });
    expect(await ensureReminderForPrescriptionItem("item-2", "doctor-user-1")).toBeNull();
  });
});
