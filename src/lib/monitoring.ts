import { safeErrorMetadata } from "./safe-error";

/**
 * Error and job-failure reporting that follows the same privacy rule as the rest of the app:
 * never messages, stacks, query strings, ids, SQL or request bodies, because any of them can
 * carry clinical data. An event says what kind of failure happened and where, nothing more.
 *
 * Events always go to the structured server log. When ALERT_WEBHOOK_URL is set (Slack,
 * Better Stack, an incident tool, ...) they are also posted there, de-duplicated so a failing
 * route cannot flood the channel.
 */

export interface MonitoringEvent {
  level: "error" | "warning";
  /** Where it came from: "api", "page", "cron:<name>", "webhook". */
  source: string;
  /** Path with ids removed, e.g. /api/patients/:id/results. */
  route?: string;
  kind: string;
  code?: string;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Strip query/fragment and replace ids so the route is a stable, non-identifying label. */
export function routeLabel(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  const clean = path.split(/[?#]/)[0].replace(UUID, ":id").replace(/\/\d{3,}(?=\/|$)/g, "/:n");
  return clean.slice(0, 200);
}

export function buildEvent(source: string, error: unknown, route?: string | null, level: MonitoringEvent["level"] = "error"): MonitoringEvent {
  const meta = safeErrorMetadata(error);
  return { level, source, route: routeLabel(route), kind: meta.kind, ...("code" in meta && meta.code ? { code: meta.code } : {}) };
}

const recent = new Map<string, number>();
const DEDUPE_MS = 5 * 60_000;

/** True when the same failure has already been sent in the last few minutes. */
export function isDuplicate(event: MonitoringEvent, now = Date.now()): boolean {
  const key = JSON.stringify([event.source, event.route ?? "", event.kind, event.code ?? ""]);
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_MS) return true;
  recent.set(key, now);
  if (recent.size > 500) for (const [k, t] of recent) if (now - t >= DEDUPE_MS) recent.delete(k);
  return false;
}

export function resetMonitoringDedupe(): void { recent.clear(); }

/** Fire-and-forget: reporting must never break or slow the request that failed. */
export function reportServerError(source: string, error: unknown, route?: string | null, level: MonitoringEvent["level"] = "error"): void {
  const event = buildEvent(source, error, route, level);
  console.error(JSON.stringify({ monitoring: true, at: new Date().toISOString(), ...event }));
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url || isDuplicate(event)) return;
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
  const text = `[Medic1905 ${env}] ${event.level.toUpperCase()} ${event.source}${event.route ? ` ${event.route}` : ""}: ${event.kind}${event.code ? ` (${event.code})` : ""}`;
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, ...event, environment: env }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => { /* alerting is best effort */ });
}

/**
 * Wrap a cron handler: a thrown error is reported and answered with a generic 500 so the
 * scheduler records the run as failed, and every run logs its duration.
 */
export function monitoredCron<A extends unknown[]>(name: string, handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const started = Date.now();
    try {
      const response = await handler(...args);
      console.info(JSON.stringify({ monitoring: true, job: name, status: response.status, ms: Date.now() - started }));
      if (response.status >= 500) reportServerError(`cron:${name}`, new Error("cron responded with a server error"));
      return response;
    } catch (error) {
      reportServerError(`cron:${name}`, error);
      return Response.json({ error: "Job failed" }, { status: 500 });
    }
  };
}
