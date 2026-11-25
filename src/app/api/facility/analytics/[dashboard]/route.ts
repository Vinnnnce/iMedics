import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type RouteParams } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { auditAnalytics, analyticsAccess, AUDITED_VIEWS, guardPeriod, rangeFromRequest } from "@/lib/analytics/http";
import { loadDashboard } from "@/lib/analytics";
import { DASHBOARD_RULES } from "@/lib/analytics/scope";
import type { DashboardKey } from "@/lib/analytics/types";

const keySchema = z.string().refine((k): k is DashboardKey => Object.prototype.hasOwnProperty.call(DASHBOARD_RULES, k), "Unknown dashboard");

// GET — one dashboard for a period (and optional comparison). Authorisation happens in loadDashboard.
export const GET = withAuth<{ dashboard: string }>(null, async (req, { user, params }) => {
  const parsed = keySchema.safeParse((await params).dashboard);
  if (!parsed.success) throw badRequest("Unknown dashboard");
  const dashboard = parsed.data as DashboardKey;
  const { access, scope } = await analyticsAccess(user, req, dashboard === "my-performance");
  const payload = await guardPeriod(() => loadDashboard(scope, dashboard, rangeFromRequest(req)));
  if (AUDITED_VIEWS.has(dashboard)) await auditAnalytics(access, "ANALYTICS_VIEW", dashboard, { period: payload.range.current.startDate + "/" + payload.range.current.endDate }, req);
  return NextResponse.json(payload);
});

void (null as unknown as RouteParams<unknown>);
