import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

// GET /api/facility/investigations — the hospital's unified investigation
// tracking: laboratory orders it requested and diagnostic referrals it sent
// (Module 01, Category 04), across pending/completed/cancelled states.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const { limit } = parseQuery(req, listSchema);

  const [labOrders, diagnosticReferrals, criticalAlerts] = await Promise.all([
    prisma.labOrder.findMany({
      where: { requestingFacilityId: access.facility.id },
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        status: true,
        priority: true,
        panelType: true,
        createdAt: true,
        patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true } },
        performingFacility: { select: { id: true, laboratoryName: true } },
        items: { select: { labTest: { select: { code: true, name: true } } } },
        specimens: { select: { id: true, accessionNumber: true, status: true } },
        results: { select: { id: true, status: true, values: { select: { flag: true } }, verifiedAt: true } },
      },
    }),
    prisma.facilityBooking.findMany({
      where: { requestingFacilityId: access.facility.id },
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        status: true,
        preferredAt: true,
        workflowStage: true,
        serviceName: true,
        createdAt: true,
        patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true } },
        service: { select: { facility: { select: { id: true, laboratoryName: true } } } },
        diagnosticReport: { select: { id: true, status: true, sentAt: true } },
      },
    }),
    prisma.criticalResultAlert.count({
      where: { orderingFacilityId: access.facility.id, status: { in: ["SENT", "ESCALATED"] } },
    }),
  ]);

  return NextResponse.json({
    labOrders,
    diagnosticReferrals,
    criticalAlertsPending: criticalAlerts,
  });
});
