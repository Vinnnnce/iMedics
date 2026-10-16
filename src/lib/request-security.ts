import { forbidden } from "./errors";

/** Cookie-authenticated writes must originate from this app, not another website. */
export function assertSameOriginWrite(req: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) return;
  if (req.headers.get("sec-fetch-site") === "cross-site") throw forbidden("Cross-site request rejected");
  const origin = req.headers.get("origin");
  // Non-browser clients may omit Origin. They still need an authenticated session.
  if (!origin) return;
  try {
    if (new URL(origin).origin === new URL(req.url).origin) return;
  } catch { /* Malformed or opaque origins fail closed. */ }
  throw forbidden("Cross-site request rejected");
}
