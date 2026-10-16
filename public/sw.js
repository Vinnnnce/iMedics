/* Medic1905 service worker: shows push notifications and opens the app when one is clicked.
   Notification text is generic by design (no health details); the app shows the details after sign-in. */
self.addEventListener("push", (event) => {
  let payload = { title: "Medic1905", body: "You have a new notification.", url: "/" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    /* keep the generic default */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      data: { url: payload.url },
      // One notification per topic instead of a stack on the lock screen.
      tag: payload.url,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target;
  try { target = new URL(event.notification.data?.url || "/", self.location.origin); }
  catch { target = new URL("/", self.location.origin); }
  const url = target.origin === self.location.origin ? target.href : new URL("/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.navigate(url).then(() => client.focus());
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
