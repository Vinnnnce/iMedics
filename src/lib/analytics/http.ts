import type { NextRequest } from "next/server";
import type { User } from "@prisma/client";
import { requireFacilityAccess, type FacilityAccess } from "@/lib/facility-auth";
import { writeAudit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";
import { buildScope, departmentFilter, type AnalyticsScope } from "./scope";
import { PeriodError, resolveRange, type RangeInput } from "./periods";
import { parseRangeInput } from "./index";
import type { Ctx } from "./core";
import type { DashboardKey } from "./types";

/** Verified facility membership + analytics scope. `personal` pages need only an active membership. */
export async function analyticsAccess(user: User, req: NextRequest, personal = false): Promise<{ access: FacilityAccess; scope: AnalyticsScope }> {
  const access = await requireFacilityAccess(user, personal ? null : "VIEW_ANALYTICS", req);
  const scope = await buildScope({ user, facility: access.facility, staffId: access.staffId, permissions: access.permissions });
  return { access, scope };
}

export function rangeFromRequest(req: NextRequest): RangeInput {
  return parseRangeInput(new URL(req.url).searchParams);
}

/** Turn period errors into 400s instead of 500s. */
export async function guardPeriod<T>(fn: () => Promise<T> | T): Promise<T> {
  try { return await fn(); } catch (e) { if (e instanceof PeriodError) throw badRequest(e.message); throw e; }
}

export async function makeCtx(scope: AnalyticsScope, input: RangeInput, now = new Date()): Promise<Ctx> {
  const range = await guardPeriod(() => resolveRange(input, scope.calendar, now));
  return { scope, range, dept: await departmentFilter(scope), now };
}

/** Dashboards whose views are themselves sensitive enough to be audited. */
export const AUDITED_VIEWS: ReadonlySet<DashboardKey> = new Set(["financial", "mortality", "doctors", "nursing"]);

export async function auditAnalytics(access: FacilityAccess, action: string, resource: string, details: Record<string, string | number | boolean | null>, req: NextRequest): Promise<void> {
  await writeAudit({ userId: access.user.id, facilityId: access.facility.id, actorRole: access.user.role, action, resourceType: "Analytics", resourceId: null, details: { resource, ...details }, req });
}

export function describeScope(scope: AnalyticsScope): string {
  return scope.departmentIds === null ? "Whole facility" : "Limited to the viewer's assigned departments";
}
