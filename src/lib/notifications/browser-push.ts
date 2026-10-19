"use client";

function decodeVapidPublicKey(key: string): ArrayBuffer {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(key)) {
    throw new Error("Push notifications are not configured with a valid server key.");
  }
  const padded = (key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new Error("Push notifications are not configured with a valid server key.");
  }
  const applicationServerKey = new ArrayBuffer(bytes.length);
  new Uint8Array(applicationServerKey).set(bytes);
  return applicationServerKey;
}

export async function subscribeWithVapidKey(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
): Promise<PushSubscription> {
  const applicationServerKey = decodeVapidPublicKey(vapidPublicKey);
  const applicationServerKeyBytes = new Uint8Array(applicationServerKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const currentKey = existing.options.applicationServerKey;
    const currentKeyBytes = currentKey ? new Uint8Array(currentKey) : null;
    const matchesKey = currentKeyBytes?.length === applicationServerKeyBytes.length
      && currentKeyBytes.every((byte, index) => byte === applicationServerKeyBytes[index]);
    if (matchesKey) return existing;
    if (!await existing.unsubscribe()) {
      throw new Error("The previous push subscription could not be replaced. Turn push off and try again.");
    }
  }

  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  } catch (error) {
    throw new Error(
      "The browser's push service could not register this device. Check your connection and retry; if it continues, contact the site administrator.",
      { cause: error },
    );
  }
}
