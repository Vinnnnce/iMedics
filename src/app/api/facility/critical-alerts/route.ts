import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";

const listSchema = z.object({
  status: z.enum(["SENT", "ACKNOWLEDGED", "ESCALATED", "RESOLVED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/facility/critical-alerts — critical-result alerts. Hospitals see
// alerts for their orders; laboratories see alerts raised on their results.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const kind = await requireFacilityKind(access, ["HOSPITAL", "LABORATORY"]);
  const { status, limit } = parseQuery(req, listSchema);

  const where =
    kind === "HOSPITAL"
      ? { orderingFacilityId: access.facility.id, ...(status ? { status } : {}) }
      : // For a laboratory: alerts whose result's order was performed here.
        { labResult: { labOrder: { performingFacilityId: access.facility.id } }, ...(status ? { status } : {}) };

  const alerts = await prisma.criticalResultAlert.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      status: true,
      createdAt: true,
      acknowledgedAt: true,
      acknowledgedBy: { select: { name: true } },
      escalatedAt: true,
      escalationLevel: true,
      note: true,
      labResult: {
        select: {
          id: true,
          verifiedAt: true,
          values: { select: { flag: true } },
          labOrder: {
            select: {
              id: true,
              status: true,
              patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ alerts });
});
