import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  raw: vi.fn(), execute: vi.fn(), user: vi.fn(), create: vi.fn(), count: vi.fn(),
  preferences: vi.fn(), email: vi.fn(), push: vi.fn(), pushConfigured: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $queryRaw: mocks.raw, $executeRaw: mocks.execute, $transaction: mocks.transaction,
  user: { findFirst: mocks.user }, pushSubscription: { count: mocks.count },
} }));
vi.mock("./preferences", () => ({
  getPreferenceMatrix: mocks.preferences,
  isChannelEnabled: (prefs: Record<string, boolean>, _type: string, channel: string) => prefs[channel],
}));
vi.mock("./email", () => ({ renderEmail: () => ({ subject: "Update", html: "Update", text: "Update" }), sendEmail: mocks.email }));
vi.mock("./push", () => ({ isPushConfigured: mocks.pushConfigured, sendPush: mocks.push }));
import { deliveryType, deliverPendingNotifications, hasNotificationOutbox, persistQueuedNotification } from "./outbox";

const job = { id: "job-1", owner_id: "user-1", title: "Account updated", href: "/profile",
  event_key: "notify:SYSTEM:notification-1", email_done: false, push_done: false };
afterEach(() => vi.unstubAllEnvs());
describe("existing-table notification outbox", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("RESEND_API_KEY", "test-only-not-a-secret");
    mocks.raw.mockResolvedValue([job]);
    mocks.user.mockResolvedValue({ email: "nobody@example.com" });
    mocks.preferences.mockResolvedValue({ EMAIL: true, PUSH: true });
    mocks.count.mockResolvedValue(1);
    mocks.pushConfigured.mockReturnValue(true);
    mocks.email.mockResolvedValue(undefined);
    mocks.push.mockResolvedValue(true);
    mocks.transaction.mockImplementation(async callback => callback({ notification: { create: mocks.create }, $executeRaw: mocks.execute }));
  });
  it.each([
    ["critical:result:user", "LAB_RESULT"], ["followup:task", "APPOINTMENT"],
    ["notify:MESSAGE:id", "MESSAGE"], ["notify:PAYMENT:id", "PAYMENT"],
    ["notify:SYSTEM:id", "SYSTEM"], ["notify:LAB_RESULT:id", "LAB_RESULT"],
  ])("preserves preference category for %s", (key, type) => expect(deliveryType(key)).toBe(type));
  it("detects an absent existing migration without creating tables", async () => {
    mocks.raw.mockResolvedValue([{ installed: null }]);
    expect(await hasNotificationOutbox()).toBe(false);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("writes the in-app notification and delivery record in one transaction", async () => {
    await persistQueuedNotification("user-1", { type: "SYSTEM", title: "Account updated", body: "Update", href: "/profile", data: {} }, true);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.create.mock.calls[0][0].data.data.toast).toBe(true);
    expect(mocks.execute.mock.calls[0][0].join("?")).toContain("INSERT INTO workspace_delivery");
  });
  it("does not insert a job after notification persistence fails", async () => {
    mocks.create.mockRejectedValue(new Error("database unavailable"));
    await expect(persistQueuedNotification("user-1", { type: "SYSTEM", title: "Update", body: "Update", href: "/", data: {} }, true)).rejects.toThrow();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("leases jobs before sending and supplies email idempotency", async () => {
    expect(await deliverPendingNotifications()).toEqual({ attempted: 1, completed: 1 });
    const sql = mocks.raw.mock.calls[0][0].join("?");
    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain("attempts < 5");
    expect(mocks.email.mock.calls[0][0].idempotencyKey).toBe(job.id);
    expect(mocks.push.mock.calls[0][1].type).toBe("SYSTEM");
  });
  it("checks current channel consent at delivery time", async () => {
    mocks.preferences.mockResolvedValue({ EMAIL: false, PUSH: false });
    expect((await deliverPendingNotifications()).completed).toBe(1);
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("does not redeliver completed channels", async () => {
    mocks.raw.mockResolvedValue([{ ...job, email_done: true }]);
    await deliverPendingNotifications();
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledOnce();
  });
  it("retries provider failure without counting it as complete", async () => {
    mocks.email.mockRejectedValue(new Error("provider unavailable"));
    expect((await deliverPendingNotifications()).completed).toBe(0);
    expect(mocks.execute.mock.calls[0]).toContain(false);
  });
  it("keeps unconfigured channels pending without exhausting their retry budget", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    mocks.pushConfigured.mockReturnValue(false);
    expect((await deliverPendingNotifications()).completed).toBe(0);
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.execute.mock.calls[0]).toContain(1);
  });
  it("does not send to blocked or removed recipients", async () => {
    mocks.user.mockResolvedValue(null);
    await deliverPendingNotifications();
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("does not claim push delivery when no browser is enrolled", async () => {
    mocks.count.mockResolvedValue(0);
    expect((await deliverPendingNotifications()).completed).toBe(0);
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
