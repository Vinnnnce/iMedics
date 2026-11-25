/**
 * Dashboard dispatcher: resolves the period, runs the right module, caches the aggregate payload.
 *
 * Caching: payloads hold only aggregates (no patient identifiers) and are keyed by facility,
 * dashboard, period, comparison and department scope. Live dashboards are never cached; closed
 * periods are cached for an hour, periods still in progress for two minutes.
 */
import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";
import { assertDashboardAllowed, departmentFilter, DASHBOARD_RULES, type AnalyticsScope } from "./scope";
import { resolveRange, type RangeInput, type ResolvedRange } from "./periods";
import type { Ctx } from "./core";
import type { DashboardKey, DashboardPayload } from "./types";
import { hospitalDashboard, mortalityDashboard } from "./hospital";
import { emergencyDashboard, commandCentre } from "./emergency";
import { nursingDashboard } from "./nursing";
import { laboratoryDashboard } from "./laboratory";
import { diagnosticDashboard } from "./diagnostic";
import { pharmacyDashboard } from "./pharmacy";
import { financialDashboard, qualityDashboard, doctorsDashboard, departmentsDashboard } from "./management";
import { forecastDashboard } from "./forecast";
import { overviewDashboard } from "./overview";
import { myFacilityPerformance } from "./personal";

type Builder = (ctx: Ctx) => Promise<Pick<DashboardPayload, "kpis" | "sections" | "gaps">>;

const BUILDERS: Record<DashboardKey, Builder> = {
  overview: overviewDashboard, "command-centre": commandCentre, hospital: hospitalDashboard, emergency: emergencyDashboard, mortality: mortalityDashboard,
  nursing: nursingDashboard, doctors: doctorsDashboard, laboratory: laboratoryDashboard, diagnostic: diagnosticDashboard, pharmacy: pharmacyDashboard,
  departments: departmentsDashboard, quality: qualityDashboard, financial: financialDashboard, forecast: forecastDashboard, "my-performance": myFacilityPerformance,
};

const NEVER_CACHED = new Set<DashboardKey>(["command-centre", "my-performance"]);

const rangeKey = (r: ResolvedRange, dept: string[] | null, canFin: boolean) =>
  [r.current.startDate, r.current.endDate, r.previous ? `${r.previous.startDate}_${r.previous.endDate}` : "none", r.calendar.timeZone, r.calendar.weekStartsOn, canFin ? "fin" : "nofin", dept ? dept.slice().sort().join(",") : "all"].join("|").slice(0, 200);

export function parseRangeInput(params: URLSearchParams): RangeInput {
  const get = (k: string) => params.get(k) ?? undefined;
  return {
    preset: get("preset") as RangeInput["preset"], from: get("from"), to: get("to"), compare: get("compare") as RangeInput["compare"],
    compareFrom: get("compareFrom"), compareTo: get("compareTo"),
  };
}

export async function loadDashboard(scope: AnalyticsScope, dashboard: DashboardKey, input: RangeInput, opts: { now?: Date; skipCache?: boolean } = {}): Promise<DashboardPayload> {
  if (dashboard === "my-performance") {
    if (scope.accessLevel === "NONE") throw forbidden("No access");
  } else {
    assertDashboardAllowed(scope, dashboard);
  }
  const now = opts.now ?? new Date();
  const range = resolveRange(input, scope.calendar, now);
  const dept = await departmentFilter(scope);
  const ctx: Ctx = { scope, range, dept, now };
  const facilityId = scope.facility.id;
  const key = dashboard === "my-performance" ? "" : rangeKey(range, scope.departmentIds, scope.canViewFinancial);
  const cacheable = !NEVER_CACHED.has(dashboard) && !opts.skipCache;

  if (cacheable) {
    const hit = await prisma.analyticsSnapshot.findUnique({ where: { facilityId_dashboard_cacheKey: { facilityId, dashboard, cacheKey: key } } });
    if (hit && hit.expiresAt > now) return { ...(hit.payload as unknown as DashboardPayload), cached: true, computedAt: hit.computedAt.toISOString() };
  }
  const built = await BUILDERS[dashboard](ctx);
  const payload: DashboardPayload = {
    dashboard, title: DASHBOARD_RULES[dashboard].label,
    facility: { id: facilityId, name: scope.facilityName, kind: scope.kind },
    range: {
      preset: range.preset, compare: range.compare, likeForLike: range.likeForLike, timeZone: range.calendar.timeZone,
      current: { start: range.current.start.toISOString(), end: range.current.end.toISOString(), startDate: range.current.startDate, endDate: range.current.endDate, label: range.current.label },
      previous: range.previous ? { start: range.previous.start.toISOString(), end: range.previous.end.toISOString(), startDate: range.previous.startDate, endDate: range.previous.endDate, label: range.previous.label } : null,
    },
    ...built, computedAt: now.toISOString(), cached: false, departmentScoped: scope.departmentIds !== null,
  };
  if (cacheable) {
    const inProgress = now < range.current.end;
    const expiresAt = new Date(now.getTime() + (inProgress ? 2 * 60_000 : 60 * 60_000));
    await prisma.analyticsSnapshot.upsert({
      where: { facilityId_dashboard_cacheKey: { facilityId, dashboard, cacheKey: key } },
      create: { facilityId, dashboard, cacheKey: key, payload: payload as never, computedAt: now, expiresAt },
      update: { payload: payload as never, computedAt: now, expiresAt },
    }).catch(() => undefined); // a cache write must never fail a dashboard
  }
  return payload;
}
