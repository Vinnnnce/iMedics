import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { facilityAnalytics } from "@/lib/investigations/analytics";

// GET — turnaround, volume, overdue and rejection analytics for the facility.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "VIEW_ANALYTICS", req);
  return NextResponse.json(await facilityAnalytics(access.facility.id));
});
