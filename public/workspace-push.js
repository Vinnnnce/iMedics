/* Separate service worker. Only safe, generic lock-screen text is displayed. */
self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* generic fallback */ }
  const candidate = payload.href || payload.url;
  const href = typeof candidate === "string" && /^\/(?!\/)/.test(candidate) ? candidate : "/workspace";
  event.waitUntil(self.registration.showNotification("iMedics", {
    body: "You have an update in your secure account. Sign in to view it.",
    icon: "/favicon.ico", data: { href }, tag: "imedics-update"
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const href = new URL(event.notification.data?.href || "/workspace", self.location.origin);
  if (href.origin === self.location.origin) event.waitUntil(self.clients.openWindow(href.href));
});
