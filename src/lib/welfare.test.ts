import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Inactivity-monitoring logic tests with a mocked Prisma client.
 * The scenarios follow the 48-hour example in the specification.
 */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inactivityRule: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    welfareAlert: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    welfareAlertDelivery: { create: vi.fn(), update: vi.fn() },
    trustedContact: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/notifications/service", () => ({
  notifyUser: vi.fn(),
  notifyUsers: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));

import { runInactivityChecks } from "./welfare";
import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, { partial: true }) as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const now = new Date("2026-10-18T12:00:00Z");

function resetMocks() {
  for (const model of Object.values(mockPrisma)) for (const fn of Object.values(model)) fn.mockReset();
}

const rule = {
  id: "rule-1",
  patientId: "patient-1",
  thresholdHours: 48,
  escalationHours: 6,
  gracePeriodMinutes: 0,
  quietHoursStart: null,
  quietHoursEnd: null,
  contactIds: ["contact-1", "contact-2"],
  active: true,
  consentAt: new Date(),
  consentText: "consent",
  createdAt: now,
  updatedAt: now,
  patient: { userId: "user-1" },
};

const contact = {
  id: "contact-1",
  patientId: "patient-1",
  userId: "contact-user-1",
  name: "Ada",
  relationship: "daughter",
  phone: null,
  email: null,
  createdAt: now,
  updatedAt: now,
};

beforeEach(resetMocks);

describe("runInactivityChecks", () => {
  it("triggers a welfare alert after 48 hours of inactivity", async () => {
    mockPrisma.inactivityRule.findMany.mockResolvedValue([rule]);
    mockPrisma.user.findUnique.mockResolvedValue({
      lastActiveAt: new Date("2026-10-16T10:00:00Z"), // 50 hours ago
      deletedAt: null,
      status: "ACTIVE",
    });
    mockPrisma.welfareAlert.findFirst.mockResolvedValue(null);
    mockPrisma.welfareAlert.create.mockResolvedValue({ id: "alert-1", status: "PENDING" });
    mockPrisma.trustedContact.findUnique.mockResolvedValue(contact);
    mockPrisma.welfareAlert.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.welfareAlertDelivery.create.mockResolvedValue({ id: "d1" });
    mockPrisma.welfareAlertDelivery.update.mockResolvedValue({});

    const result = await runInactivityChecks(now);
    expect(result.triggered).toBe(1);
    expect(mockPrisma.welfareAlert.create).toHaveBeenCalledOnce();
    expect(mockPrisma.welfareAlert.create.mock.calls[0][0]).toMatchObject({
      data: { ruleId: "rule-1", status: "PENDING", lastActivityAt: new Date("2026-10-16T10:00:00Z") },
    });
  });

  it("does not alert when the patient was active within the threshold", async () => {
    mockPrisma.inactivityRule.findMany.mockResolvedValue([rule]);
    mockPrisma.user.findUnique.mockResolvedValue({
      lastActiveAt: new Date("2026-10-18T11:00:00Z"), // 1 hour ago
      deletedAt: null,
      status: "ACTIVE",
    });
    mockPrisma.welfareAlert.updateMany.mockResolvedValue({ count: 0 });

    const result = await runInactivityChecks(now);
    expect(result.triggered).toBe(0);
    expect(mockPrisma.welfareAlert.create).not.toHaveBeenCalled();
  });

  it("never sends duplicate alerts for the same inactivity event", async () => {
    const noEscalationRule = { ...rule, escalationHours: null };
    mockPrisma.inactivityRule.findMany.mockResolvedValue([noEscalationRule]);
    mockPrisma.user.findUnique.mockResolvedValue({
      lastActiveAt: new Date("2026-10-16T10:00:00Z"),
      deletedAt: null,
      status: "ACTIVE",
    });
    // An alert is already open for this rule.
    mockPrisma.welfareAlert.findFirst.mockResolvedValue({ id: "alert-1", status: "SENT", triggeredAt: new Date("2026-10-17T10:00:00Z") });

    const result = await runInactivityChecks(now);
    expect(result.triggered).toBe(0);
    expect(mockPrisma.welfareAlert.create).not.toHaveBeenCalled();
  });

  it("resolves open alerts when the patient becomes active again", async () => {
    mockPrisma.inactivityRule.findMany.mockResolvedValue([rule]);
    mockPrisma.user.findUnique.mockResolvedValue({
      lastActiveAt: new Date("2026-10-18T11:30:00Z"),
      deletedAt: null,
      status: "ACTIVE",
    });
    mockPrisma.welfareAlert.findFirst.mockResolvedValue({ id: "alert-1", status: "SENT", triggeredAt: new Date("2026-10-17T10:00:00Z") });
    mockPrisma.welfareAlert.update.mockResolvedValue({});

    const result = await runInactivityChecks(now);
    expect(result.resolved).toBe(1);
    expect(mockPrisma.welfareAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVED_NO_ACTION" }) }),
    );
  });

  it("escalates an unacknowledged alert to the second contact", async () => {
    mockPrisma.inactivityRule.findMany.mockResolvedValue([rule]);
    mockPrisma.user.findUnique.mockResolvedValue({
      lastActiveAt: new Date("2026-10-16T10:00:00Z"),
      deletedAt: null,
      status: "ACTIVE",
    });
    // Open alert triggered 10 hours ago; escalation is 6 hours.
    mockPrisma.welfareAlert.findFirst.mockResolvedValue({ id: "alert-1", status: "SENT", triggeredAt: new Date("2026-10-18T02:00:00Z") });
    mockPrisma.welfareAlert.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.trustedContact.findUnique.mockResolvedValue(contact);
    mockPrisma.welfareAlertDelivery.create.mockResolvedValue({ id: "d1" });
    mockPrisma.welfareAlertDelivery.update.mockResolvedValue({});

    const result = await runInactivityChecks(now);
    expect(result.escalated).toBe(1);
    expect(mockPrisma.welfareAlert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "alert-1" }) }),
    );
  });

  it("skips rules for deactivated or suspended accounts", async () => {
    mockPrisma.inactivityRule.findMany.mockResolvedValue([rule]);
    mockPrisma.user.findUnique.mockResolvedValue({
      lastActiveAt: new Date("2026-10-16T10:00:00Z"),
      deletedAt: null,
      status: "SUSPENDED",
    });

    const result = await runInactivityChecks(now);
    expect(result.triggered).toBe(0);
    expect(mockPrisma.welfareAlert.create).not.toHaveBeenCalled();
  });
});
