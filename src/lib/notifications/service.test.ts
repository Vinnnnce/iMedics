import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(), recent: vi.fn(), create: vi.fn(), preferences: vi.fn(), hasOutbox: vi.fn(),
  persist: vi.fn(), deliver: vi.fn(), after: vi.fn(), email: vi.fn(), push: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst: mocks.user }, notification: { findFirst: mocks.recent, create: mocks.create } } }));
vi.mock("./outbox", () => ({ hasNotificationOutbox: mocks.hasOutbox, persistQueuedNotification: mocks.persist, deliverPendingNotifications: mocks.deliver }));
vi.mock("./preferences", () => ({ getPreferenceMatrix: mocks.preferences, isChannelEnabled: () => true }));
vi.mock("./email", () => ({ renderEmail: () => ({}), sendEmail: mocks.email }));
vi.mock("./push", () => ({ sendPush: mocks.push }));
import { notifyUser, queueNotification } from "./service";
describe("notification persistence and lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "user-1", role: "PATIENT", email: "nobody@example.com" });
    mocks.hasOutbox.mockResolvedValue(true);
    mocks.persist.mockResolvedValue(undefined);
  });
  it("persists before registering after-response delivery", async () => {
    await queueNotification("user-1", { kind: "ACCOUNT_UPDATED" });
    expect(mocks.persist).toHaveBeenCalledOnce();
    expect(mocks.after).toHaveBeenCalledOnce();
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.persist.mock.invocationCallOrder[0]).toBeLessThan(mocks.after.mock.invocationCallOrder[0]);
    await mocks.after.mock.calls[0][0]();
    expect(mocks.deliver).toHaveBeenCalledWith("user-1");
  });
  it("does not hide database persistence failure", async () => {
    mocks.persist.mockRejectedValue(new Error("database unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(queueNotification("user-1", { kind: "ACCOUNT_UPDATED" })).rejects.toThrow("database unavailable");
    expect(mocks.after).not.toHaveBeenCalled();
    log.mockRestore();
  });
  it("still persists in-app alerts without the pre-existing outbox migration", async () => {
    mocks.hasOutbox.mockResolvedValue(false);
    await notifyUser("user-1", { kind: "ACCOUNT_UPDATED" });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it("coalesces unread message bursts", async () => {
    mocks.recent.mockResolvedValue({ id: "previous" });
    await notifyUser("user-1", { kind: "MESSAGE_RECEIVED", conversationId: "conversation-1" });
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it("does not notify unavailable recipients", async () => {
    mocks.user.mockResolvedValue(null);
    await queueNotification("user-1", { kind: "ACCOUNT_UPDATED" });
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });
  it.each([true, false])("retains synthetic in-app alerts but never dispatches externally (outbox=%s)", async (queued) => {
    mocks.user.mockResolvedValue({ id: "synthetic", role: "PATIENT", email: "synthetic+clerk_test@example.com", testAccountExpiresAt: new Date(Date.now() + 60000) });
    mocks.hasOutbox.mockResolvedValue(queued);
    await queueNotification("synthetic", { kind: "ACCOUNT_UPDATED" });
    expect(queued ? mocks.persist : mocks.create).toHaveBeenCalledOnce();
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
