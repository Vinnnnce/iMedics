/**
 * Content-Security-Policy builder. Third-party hosts are listed in one place so a blocked
 * resource is a one-line change. Rolled out in report-only mode first (CSP_MODE=report-only,
 * the default) so real traffic shows what would break before anything is enforced
 * (CSP_MODE=enforce). CSP_MODE=off removes the header.
 *
 * Next.js and the theme bootstrap script use inline scripts, so script-src keeps
 * 'unsafe-inline' until a nonce-based policy is introduced. The policy still blocks injected
 * third-party scripts, plugins, framing and form hijacking.
 */
export type CspMode = "off" | "report-only" | "enforce";

export function cspMode(value: string | undefined): CspMode {
  return value === "off" || value === "enforce" ? value : "report-only";
}

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).origin; } catch { return null; }
}

export function buildCsp(env: Record<string, string | undefined> = process.env, dev = env.NODE_ENV !== "production"): string {
  const clerkHosts = ["https://*.clerk.accounts.dev", "https://*.clerk.com", "https://clerk.com"];
  const s3 = origin(env.S3_ENDPOINT) ?? (env.S3_BUCKET && env.S3_REGION ? `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com` : null);
  const s3Hosts = [s3, env.S3_REGION ? `https://s3.${env.S3_REGION}.amazonaws.com` : null].filter((h): h is string => Boolean(h));
  const alert = origin(env.ALERT_WEBHOOK_URL);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...clerkHosts, "https://challenges.cloudflare.com", "https://js.paystack.co", "https://checkout.paystack.com"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "img-src": ["'self'", "data:", "blob:", "https://img.clerk.com", "https://images.clerk.dev", ...s3Hosts],
    "media-src": ["'self'", "blob:", ...s3Hosts],
    "connect-src": ["'self'", ...clerkHosts, "https://api.paystack.co", "https://checkout.paystack.com", ...s3Hosts, ...(alert ? [alert] : []), ...(dev ? ["ws:", "http://localhost:*"] : [])],
    "frame-src": ["'self'", "https://challenges.cloudflare.com", "https://checkout.paystack.com", ...clerkHosts],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`).join("; ");
}

export function cspHeader(env: Record<string, string | undefined> = process.env): { key: string; value: string } | null {
  const mode = cspMode(env.CSP_MODE);
  if (mode === "off") return null;
  return { key: mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: buildCsp(env) };
}
