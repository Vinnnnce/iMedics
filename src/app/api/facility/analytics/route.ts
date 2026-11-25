import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { analyticsAccess } from "@/lib/analytics/http";
import { dashboardsFor } from "@/lib/analytics/scope";
import { COMPARE_MODES, COMPARE_MODE_LABEL, PERIOD_PRESETS, PERIOD_PRESET_LABEL } from "@/lib/analytics/periods";

// GET — which analytics the caller may open, plus the facility's calendar settings.
export const GET = withAuth(null, async (req, { user }) => {
  const { access, scope } = await analyticsAccess(user, req, true);
  return NextResponse.json({
    facility: { id: access.facility.id, name: scope.facilityName, kind: scope.kind },
    dashboards: dashboardsFor(scope).map((d) => ({ key: d.key, label: d.label, description: d.description })),
    calendar: scope.calendar,
    presets: PERIOD_PRESETS.map((key) => ({ key, label: PERIOD_PRESET_LABEL[key] })),
    comparisons: COMPARE_MODES.map((key) => ({ key, label: COMPARE_MODE_LABEL[key] })),
    canViewFinancial: scope.canViewFinancial,
    canIdentifyPatients: scope.canIdentifyPatients,
    canManageTargets: scope.permissions.includes("MANAGE_HOSPITAL_SETTINGS"),
    departmentScoped: scope.departmentIds !== null,
  });
});
