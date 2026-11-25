import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireHisPage } from "@/lib/his/page";
import { assertDashboardAllowed, buildScope, DASHBOARD_RULES } from "@/lib/analytics/scope";
import { DashboardView } from "@/components/analytics/dashboard-view";
import type { DashboardKey } from "@/lib/analytics/types";

export default async function AnalyticsDashboardPage({ params }: { params: Promise<{ dashboard: string }> }) {
  const { dashboard } = await params;
  if (!Object.prototype.hasOwnProperty.call(DASHBOARD_RULES, dashboard)) notFound();
  const key = dashboard as DashboardKey;
  const { user, facility, permissions } = await requireHisPage(null, ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"]);
  if (key !== "my-performance") {
    const scope = await buildScope({ user, facility, staffId: null, permissions: [...permissions] });
    try { assertDashboardAllowed(scope, key); } catch { redirect("/lab/analytics"); }
  }
  const rule = DASHBOARD_RULES[key];
  return (
    <Suspense>
      <DashboardView endpoint={`/api/facility/analytics/${key}`} dashboard={key} initialTitle={rule.label} exportReport={["command-centre", "my-performance"].includes(key) ? undefined : key} />
    </Suspense>
  );
}
