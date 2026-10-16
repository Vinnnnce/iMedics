/** Shared by the browser and server. Notifications never navigate off-site. */
export function safeNotificationHref(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/";
  try {
    const base = "https://notification.invalid";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch { return "/"; }
}
