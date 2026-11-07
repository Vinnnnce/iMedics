/** Matches public page families in proxy.ts. Unknown routes remain protected.
 * This controls navigation only, never authorization. */
export function isPublicPageHref(href: string | { pathname?: string | null; protocol?: string | null; host?: string | null }): boolean {
  if (typeof href !== "string") {
    if (href.protocol || href.host) return true;
    return isPublicPageHref(href.pathname ?? "/");
  }
  if (href.startsWith("#") || /^(?:https?:|mailto:|tel:|\/\/)/i.test(href)) return true;
  try {
    const path = new URL(href, "https://imedics.invalid").pathname;
    return path === "/" || /^\/(?:auth\/(?:login|signup)|sign-in|sign-up|legal|emergency|hospitals|laboratories|diagnostic-centres|news|podcasts)(?:\/|$)/.test(path);
  } catch { return false; }
}
