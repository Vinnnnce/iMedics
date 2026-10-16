import { z } from "zod";

const PROVIDERS = [
  "fcm.googleapis.com", "updates.push.services.mozilla.com",
  "updates-autopush.stage.mozaws.net", "web.push.apple.com",
];

/** Do not let stored user-supplied URLs turn the delivery worker into an SSRF proxy. */
export function isSafePushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && (!url.port || url.port === "443")
      && !url.username && !url.password && !url.hash && url.pathname.length > 1
      && (PROVIDERS.includes(url.hostname) || url.hostname.endsWith(".notify.windows.com"));
  } catch { return false; }
}

const key = (bytes: number) => z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/)
  .refine(value => Buffer.from(value, "base64url").length === bytes, "Invalid subscription key");
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(2000).refine(isSafePushEndpoint, "Unsupported or unsafe push provider"),
  keys: z.object({
    p256dh: key(65).refine(value => Buffer.from(value, "base64url")[0] === 4, "Invalid public key"),
    auth: key(16),
  }),
});
