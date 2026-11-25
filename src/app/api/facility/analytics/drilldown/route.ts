import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api";
import { analyticsAccess, auditAnalytics, makeCtx, rangeFromRequest } from "@/lib/analytics/http";
import { loadDrilldown } from "@/lib/analytics/drilldown";
import { writeAudit } from "@/lib/audit";

const querySchema = z.object({
  key: z.string().min(1).max(60),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  identified: z.enum(["0", "1"]).default("0"),
});

// GET — the records behind a figure, for the same period and department scope as the dashboard.
export const GET = withAuth(null, async (req, { user }) => {
  const { access, scope } = await analyticsAccess(user, req);
  const q = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const ctx = await makeCtx(scope, rangeFromRequest(req));
  const page = await loadDrilldown(ctx, q.key, q.page, q.pageSize, q.identified === "1");
  if (page.identified) await writeAudit({ userId: user.id, facilityId: access.facility.id, actorRole: user.role, action: "ANALYTICS_DRILLDOWN_IDENTIFIED", resourceType: "Analytics", details: { key: q.key, rows: page.rows.length, page: page.page }, req });
  else await auditAnalytics(access, "ANALYTICS_DRILLDOWN", q.key, { rows: page.rows.length, page: page.page }, req);
  return NextResponse.json(page);
});
