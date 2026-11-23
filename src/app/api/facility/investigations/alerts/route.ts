import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { toDtos } from "@/lib/investigations/serialize";

// GET — critical-result alerts raised by this facility with their full notification / acknowledgement / escalation trail.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "VERIFY_RESULTS", req);
  const alerts = await prisma.investigation_critical_alerts.findMany({
    where: { facility_id: access.facility.id }, orderBy: [{ status: "asc" }, { created_at: "desc" }], take: 100,
    include: {
      investigation_alert_events: { orderBy: { created_at: "asc" } },
      investigation_results: { select: { investigation_order_items: { select: { id: true, name_snapshot: true, investigation_orders: { select: { order_number: true, users: { select: { name: true } }, patients: { select: { firstName: true, lastName: true, caseNumber: true } } } } } } } },
    },
  });
  return NextResponse.json({ alerts: toDtos("alert", alerts) });
});
