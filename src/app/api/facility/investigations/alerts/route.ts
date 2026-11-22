import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";

// GET — critical-result alerts raised by this facility with their full notification / acknowledgement / escalation trail.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "VERIFY_RESULTS", req);
  const alerts = await prisma.investigation_critical_alerts.findMany({
    where: { facility_id: access.facility.id }, orderBy: [{ status: "asc" }, { created_at: "desc" }], take: 100,
    include: { events: { orderBy: { created_at: "asc" } }, result: { select: { item: { select: { id: true, nameSnapshot: true, order: { select: { orderNumber: true, requestedBy: { select: { name: true } }, patient: { select: { firstName: true, lastName: true, caseNumber: true } } } } } } } } },
  });
  return NextResponse.json({ alerts });
});
