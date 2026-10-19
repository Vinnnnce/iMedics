import { describe, expect, it, vi } from "vitest";
import { subscribeWithVapidKey } from "./browser-push";

const publicKeyBytes = Uint8Array.from([4, ...Array.from({ length: 64 }, (_, index) => index)]);
const publicKey = btoa(String.fromCharCode(...publicKeyBytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function subscriptionFor(key: Uint8Array) {
  const keyBuffer = key.slice().buffer;
  return {
    options: { applicationServerKey: keyBuffer },
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

function registrationFor(existing: PushSubscription | null, newSubscription?: PushSubscription) {
  const getSubscription = vi.fn().mockResolvedValue(existing);
  const subscribe = vi.fn().mockResolvedValue(newSubscription);
  return {
    registration: {
      pushManager: { getSubscription, subscribe },
    } as unknown as ServiceWorkerRegistration,
    getSubscription,
    subscribe,
  };
}

describe("subscribeWithVapidKey", () => {
  it("reuses an existing subscription associated with the current key", async () => {
    const existing = subscriptionFor(publicKeyBytes);
    const { registration, subscribe } = registrationFor(existing);

    await expect(subscribeWithVapidKey(registration, publicKey)).resolves.toBe(existing);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("replaces a subscription associated with a previous key", async () => {
    const oldSubscription = subscriptionFor(Uint8Array.from([4, ...Array.from({ length: 64 }, () => 1)]));
    const newSubscription = subscriptionFor(publicKeyBytes);
    const { registration, subscribe } = registrationFor(oldSubscription, newSubscription);

    await expect(subscribeWithVapidKey(registration, publicKey)).resolves.toBe(newSubscription);
    expect(oldSubscription.unsubscribe).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledOnce();
  });

  it("rejects a malformed server key before calling the push service", async () => {
    const { registration, getSubscription } = registrationFor(null);

    await expect(subscribeWithVapidKey(registration, "invalid"))
      .rejects.toThrow("not configured with a valid server key");
    expect(getSubscription).not.toHaveBeenCalled();
  });
});
