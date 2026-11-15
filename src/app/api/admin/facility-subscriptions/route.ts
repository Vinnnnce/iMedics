import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { extendFacilityTrial, getFacilityAccessState } from "@/lib/facility-subscriptions";

const listQuery = z.object({
  status: z.enum(["TRIALING", "ACTIVE", "EXPIRED", "CANCELLED"]).optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

// GET /api/admin/facility-subscriptions — every facility's plan state, soonest trial end first (admin only)
export const GET = withAuth(["ADMIN"], async (req) => {
  const { status, take } = parseQuery(req, listQuery);
  const rows = await prisma.facilitySubscription.findMany({
    where: status ? { status } : undefined,
    orderBy: { trialEndsAt: "asc" },
    take,
    include: { plan: { select: { code: true, name: true } }, facility: { select: { id: true, laboratoryName: true, kind: true } } },
  });
  return NextResponse.json({ subscriptions: rows });
});

const extendSchema = z.object({
  facilityId: z.string().uuid(),
  days: z.number().int().min(1).max(366).optional(),
  until: z.coerce.date().optional(),
  reason: z.string().trim().min(10).max(500),
}).refine((v) => Boolean(v.days) !== Boolean(v.until), { message: "Give either days or a date" });

// PATCH /api/admin/facility-subscriptions — extend a facility's trial (support tool, audited, never shortens)
export const PATCH = withAuth(["ADMIN"], async (req, { user }) => {
  const input = await parseBody(req, extendSchema);
  const facility = await prisma.labStaffProfile.findUnique({ where: { id: input.facilityId }, select: { id: true } });
  if (!facility) throw notFound("Facility not found");
  const subscription = await extendFacilityTrial(facility.id, { days: input.days, until: input.until }, user.id, input.reason);
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_FACILITY_TRIAL_EXTENDED", resourceType: "LabStaffProfile", resourceId: facility.id, details: { until: subscription.trialEndsAt.toISOString(), reason: input.reason }, req });
  const { state } = await getFacilityAccessState(facility.id);
  return NextResponse.json({ success: true, trialEndsAt: subscription.trialEndsAt, phase: state.phase });
});
