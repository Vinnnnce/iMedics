import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess, assertSameFacility } from "@/lib/facility-auth";

const patchSchema = z.object({ status: z.enum(["ACCEPTED", "DECLINED", "FULFILLED"]) });

// PATCH /api/facility/referrals/[id] — accept, decline or fulfil a referral.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "MANAGE_REFERRALS", req);
  const body = await parseBody(req, patchSchema);

  const referral = await prisma.facilityReferral.findUnique({
    where: { id },
    select: { status: true, facilityId: true, fromDoctor: { select: { userId: true } } },
  });
  if (!referral) throw notFound("Referral not found");
  assertSameFacility(referral.facilityId, access.facility.id, "Referral");

  const updated = await prisma.facilityReferral.update({
    where: { id },
    data: { status: body.status, handledAt: new Date() },
    select: { id: true, status: true, handledAt: true },
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: `FACILITY_REFERRAL_${body.status}`,
    resourceType: "FacilityReferral", resourceId: id,
    details: {}, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ referral: updated });
});
