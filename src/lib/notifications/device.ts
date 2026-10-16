"use client";

/** Remove the browser's capability first, even if the server cleanup fails offline. */
export async function clearDevicePush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  try {
    await fetch("/api/notifications/push-subscription", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }), signal: AbortSignal.timeout(3000),
    });
  } catch { /* Expired subscriptions are also removed by the server delivery worker. */ }
}
