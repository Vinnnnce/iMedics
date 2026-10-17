import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedFacilityProfile } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { serializeService, serviceSchema, serviceSelect as select } from "@/lib/facility-services";


// PATCH /api/facility/services/[id] — change a service or its price. Existing bookings keep the price they were made at.
export const PATCH = withAuth<{ id: string }>(["LAB_SCIENTIST"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const facility = await getVerifiedFacilityProfile(user);
  const data = await parseBody(req, serviceSchema.partial());

  const existing = await prisma.facilityService.findFirst({ where: { id, facilityId: facility.id }, select: { id: true } });
  if (!existing) throw notFound("Service not found");

  const service = await prisma.facilityService.update({ where: { id }, data, select });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "FACILITY_SERVICE_UPDATED", resourceType: "FacilityService", resourceId: id, details: data, req });
  return NextResponse.json({ service: serializeService(service) });
});

// DELETE /api/facility/services/[id] — remove a service. One that has been booked is hidden instead, so records stay intact.
export const DELETE = withAuth<{ id: string }>(["LAB_SCIENTIST"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const facility = await getVerifiedFacilityProfile(user);
  const existing = await prisma.facilityService.findFirst({ where: { id, facilityId: facility.id }, select: { id: true, _count: { select: { bookings: true } } } });
  if (!existing) throw notFound("Service not found");

  if (existing._count.bookings > 0) await prisma.facilityService.update({ where: { id }, data: { isActive: false } });
  else await prisma.facilityService.delete({ where: { id } });

  await writeAudit({ userId: user.id, actorRole: user.role, action: "FACILITY_SERVICE_REMOVED", resourceType: "FacilityService", resourceId: id, req });
  return NextResponse.json({ success: true, hidden: existing._count.bookings > 0 });
});
