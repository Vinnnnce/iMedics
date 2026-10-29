/**
 * Critical-alert escalation scheduler tests: timing thresholds, race safety
 * (acknowledgement/resolution always wins), delayed runs that jump levels
 * still reaching every responsible recipient, atomic notification persistence,
 * the notifiedUserId fallback audience, and audit trail coverage.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    criticalResultAlert: { findMany: vi.fn(), updateMany: vi.fn() },
    labStaffProfile: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/notifications/service", () => ({ notifyUser: vi.fn(), notifyAdmins: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/notifications/outbox", () => ({ hasNotificationOutbox: vi.fn() }));

import { escalateCriticalResultAlerts, escalationLevelFor } from "./critical-alert-escalation";
import { notifyAdmins } from "@/lib/notifications/service";
import { hasNotificationOutbox } from "@/lib/notifications/outbox";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const NOW = new Date("2026-10-22T12:00:00Z");

function alertFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "alert-1",
    escalationLevel: 0,
    createdAt: new Date("2026-10-22T11:00:00Z"), // 60 minutes old by default
    labResultId: "result-1",
    labOrderId: "order-1",
    orderingFacilityId: "facility-1",
    notifiedUserId: null,
    labResult: { uploadedById: "performer-1" },
    ...overrides,
  };
}

function txMock(updateManyResult: { count: number }) {
  return {
    criticalResultAlert: { updateMany: vi.fn().mockResolvedValue(updateManyResult) },
    // Echo the queried user id so each recipient is notified as themselves.
    user: {
      findFirst: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) =>
        ({ id: where.id, role: "LAB_SCIENTIST" })),
    },
    notification: { create: vi.fn().mockResolvedValue({}) },
    $executeRaw: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.mocked(hasNotificationOutbox).mockResolvedValue(false);
  vi.mocked(notifyAdmins).mockResolvedValue(undefined);
  vi.mocked(prisma.labStaffProfile.findUnique).mockResolvedValue({ user: { id: "requester-user" } } as never);
});

describe("escalationLevelFor", () => {
  it("uses the 30-minute spec window and its 2x / 4x multipliers", () => {
    expect(escalationLevelFor(29.9, 30)).toBe(0);
    expect(escalationLevelFor(30, 30)).toBe(1);
    expect(escalationLevelFor(59.9, 30)).toBe(1);
    expect(escalationLevelFor(60, 30)).toBe(2);
    expect(escalationLevelFor(119.9, 30)).toBe(2);
    expect(escalationLevelFor(120, 30)).toBe(3);
  });
});

describe("escalateCriticalResultAlerts", () => {
  it("does nothing when no alert has waited past the window", async () => {
    vi.mocked(prisma.criticalResultAlert.findMany).mockResolvedValue([] as never);
    const summary = await escalateCriticalResultAlerts(NOW);
    expect(summary).toEqual({ checked: 0, escalated: 0, skipped: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("escalates to level 1, atomically persisting the requesting facility's notification", async () => {
    vi.mocked(prisma.criticalResultAlert.findMany).mockResolvedValue([
      alertFixture({ createdAt: new Date("2026-10-22T11:29:00Z") }), // 31 minutes old
    ] as never);
    const tx = txMock({ count: 1 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => (fn as (t: unknown) => unknown)(tx));

    const summary = await escalateCriticalResultAlerts(NOW);

    expect(summary).toEqual({ checked: 1, escalated: 1, skipped: 0 });
    expect(tx.criticalResultAlert.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "alert-1", escalationLevel: 0, acknowledgedAt: null }),
      data: expect.objectContaining({ status: "ESCALATED", escalationLevel: 1 }),
    });
    // The in-app notification is created inside the same transaction.
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "requester-user", type: "CRITICAL_RESULT" }) }),
    );
    expect(notifyAdmins).not.toHaveBeenCalled();
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "CRITICAL_ALERT_ESCALATED", resourceId: "alert-1" }));
  });

  it("writes an outbox job when the delivery table is installed", async () => {
    vi.mocked(prisma.criticalResultAlert.findMany).mockResolvedValue([
      alertFixture({ createdAt: new Date("2026-10-22T11:29:00Z") }),
    ] as never);
    vi.mocked(hasNotificationOutbox).mockResolvedValue(true);
    const tx = txMock({ count: 1 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => (fn as (t: unknown) => unknown)(tx));

    await escalateCriticalResultAlerts(NOW);

    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it("lets a concurrent acknowledgement or resolution win the race", async () => {
    vi.mocked(prisma.criticalResultAlert.findMany).mockResolvedValue([alertFixture()] as never);
    const tx = txMock({ count: 0 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => (fn as (t: unknown) => unknown)(tx));

    const summary = await escalateCriticalResultAlerts(NOW);

    expect(summary).toEqual({ checked: 1, escalated: 0, skipped: 1 });
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("does not re-escalate an alert already at its due level", async () => {
    vi.mocked(prisma.criticalResultAlert.findMany).mockResolvedValue([
      alertFixture({ escalationLevel: 2 }), // due level for 60 minutes is 2
    ] as never);

    const summary = await escalateCriticalResultAlerts(NOW);

    expect(summary).toEqual({ checked: 1, escalated: 0, skipped: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("a delayed run jumping to level 3 still notifies every responsible audience", async () => {
    vi.mocked(prisma.criticalResultAlert.findMany).mockResolvedValue([
      alertFixture({ createdAt: new Date("2026-10-22T09:50:00Z") }), // 130 minutes old
    ] as never);
    const tx = txMock({ count: 1 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => (fn as (t: unknown) => unknown)(tx));

    const summary = await escalateCriticalResultAlerts(NOW);

    expect(summary).toEqual({ checked: 1, escalated: 1, skipped: 0 });
    // Level 1+2 audience (requesting facility and performer) plus admins for level 3.
    const notifiedIds = tx.notification.create.mock.calls.map((call) => call[0].data.userId);
    expect(notifiedIds).toEqual(expect.arrayContaining(["requester-user", "performer-1"]));
    expect(notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ kind: "CRITICAL_ALERT_ESCALATED", level: 3 }));
    expect(tx.criticalResultAlert.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ escalationLevel: 0 }),
      data: expect.objectContaining({ escalationLevel: 3 }),
    });
  });

  it("notifies the alert's recorded recipient when no ordering facility exists", async () => {
    vi.mocked(prisma.criticalResultAlert.findMany).mockResolvedValue([
      alertFixture({ orderingFacilityId: null, notifiedUserId: "direct-user", createdAt: new Date("2026-10-22T11:29:00Z") }),
    ] as never);
    const tx = txMock({ count: 1 });
    tx.user.findFirst.mockResolvedValue({ id: "direct-user", role: "DOCTOR" } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => (fn as (t: unknown) => unknown)(tx));

    const summary = await escalateCriticalResultAlerts(NOW);

    expect(summary).toEqual({ checked: 1, escalated: 1, skipped: 0 });
    expect(prisma.labStaffProfile.findUnique).not.toHaveBeenCalled();
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "direct-user" }) }),
    );
  });

  it("honours a platform-configured window override", async () => {
    vi.stubEnv("CRITICAL_ALERT_ESCALATION_WINDOW_MINUTES", "10");
    vi.mocked(prisma.criticalResultAlert.findMany).mockResolvedValue([
      alertFixture({ createdAt: new Date("2026-10-22T11:48:00Z") }), // 12 minutes old
    ] as never);
    const tx = txMock({ count: 1 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) => (fn as (t: unknown) => unknown)(tx));

    const summary = await escalateCriticalResultAlerts(NOW);

    expect(summary).toEqual({ checked: 1, escalated: 1, skipped: 0 });
  });
});
