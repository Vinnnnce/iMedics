import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";

const listSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "FULFILLED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/facility/referrals — the facility's referral inbox from Medic1905 doctors.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_REFERRALS", req);
  const { status, limit } = parseQuery(req, listSchema);
  const referrals = await prisma.facilityReferral.findMany({
    where: { facilityId: access.facility.id, ...(status ? { status } : {}) },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true, status: true, note: true, createdAt: true, handledAt: true,
      service: { select: { id: true, name: true, price: true, currency: true } },
      fromDoctor: { select: { id: true, specialty: true, user: { select: { name: true } } } },
      patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true } },
      case: { select: { id: true, caseNumber: true } },
    },
  });
  return NextResponse.json({ referrals });
});
