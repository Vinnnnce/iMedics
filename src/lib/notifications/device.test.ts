import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDevicePush } from "./device";
afterEach(() => vi.unstubAllGlobals());
describe("shared-device push cleanup", () => {
  it("supports browsers without service workers", async () => {
    vi.stubGlobal("navigator", {});
    await expect(clearDevicePush()).resolves.toBeUndefined();
  });
  it("supports a browser with no enrolled subscription", async () => {
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration: vi.fn().mockResolvedValue(undefined) } });
    await expect(clearDevicePush()).resolves.toBeUndefined();
  });
  it("revokes local push capability before authenticated server cleanup", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true), fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({
      pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: "https://fcm.googleapis.com/id", unsubscribe }) },
    }) } });
    vi.stubGlobal("fetch", fetchMock);
    await clearDevicePush();
    expect(unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
  it("does not block session revocation when server cleanup is offline", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration: vi.fn().mockResolvedValue({
      pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: "https://fcm.googleapis.com/id", unsubscribe }) },
    }) } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(clearDevicePush()).resolves.toBeUndefined();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
