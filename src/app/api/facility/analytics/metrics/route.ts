import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { analyticsAccess } from "@/lib/analytics/http";
import { METRICS } from "@/lib/analytics/registry";

// GET — the Metric Definition Registry, limited to metrics the caller's role may see.
export const GET = withAuth(null, async (req, { user }) => {
  const { scope } = await analyticsAccess(user, req);
  const metrics = METRICS.filter((m) => !m.requires || scope.permissions.includes(m.requires));
  return NextResponse.json({ metrics });
});
