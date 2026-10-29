import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedLabProfile } from "@/lib/access";
import { activeFacilityIdsForUser } from "@/lib/facility-auth";
import { conflict, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ status: z.enum(["IN_PROGRESS", "CANCELLED"]) });

// PATCH /api/lab-orders/[id]
//  - lab staff: start work on an order (ORDERED -> IN_PROGRESS). Lab staff may
//    only touch their own facility's orders; an unassigned legacy order is
//    claimed atomically for their facility when they start it.
//  - the ordering doctor: cancel an order that has not been started
// Completion happens automatically when results are submitted against the order.
export const PATCH = withAuth<{ id: string }>(["DOCTOR", "LAB_SCIENTIST"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { status } = await parseBody(req, schema);

  if (user.role === "LAB_SCIENTIST") {
    const profile = await getVerifiedLabProfile(user);
    if (status !== "IN_PROGRESS") throw conflict("Lab staff can only start orders");

    // Facility scoping: the order must belong to one of the caller's active
    // facilities, or be an unassigned legacy order that can be claimed.
    const facilityIds = new Set(await activeFacilityIdsForUser(user.id));
    facilityIds.add(profile.id);

    const order = await prisma.labOrder.findFirst({
      where: {
        id,
        status: "ORDERED",
        OR: [{ performingFacilityId: { in: [...facilityIds] } }, { performingFacilityId: null }],
      },
      select: { id: true, status: true, performingFacilityId: true },
    });
    if (!order) throw notFound("Lab order not found");

    let claimedFacilityId = order.performingFacilityId;
    if (!claimedFacilityId) {
      // Atomic claim: only succeeds if the order is still unassigned.
      const claimed = await prisma.labOrder.updateMany({
        where: { id, performingFacilityId: null },
        data: { performingFacilityId: profile.id },
      });
      if (claimed.count === 0) throw conflict("This order was just claimed by another facility");
      claimedFacilityId = profile.id;
    }

    const updated = await prisma.labOrder.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });

    await writeAudit({
      userId: user.id,
      actorRole: user.role,
      action: `LAB_ORDER_${status}`,
      resourceType: "LabOrder",
      resourceId: id,
      req,
    });

    return NextResponse.json({ success: true, order: updated });
  }

  if (status !== "CANCELLED") throw conflict("Doctors can only cancel orders");

  const order = await prisma.labOrder.findFirst({
    where: { id, orderedById: user.id },
    select: { id: true, status: true },
  });
  if (!order) throw notFound("Lab order not found");
  if (order.status !== "ORDERED") throw conflict(`This order is already ${order.status.toLowerCase().replace("_", " ")}`);

  const updated = await prisma.labOrder.update({ where: { id }, data: { status }, select: { id: true, status: true } });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: `LAB_ORDER_${status}`,
    resourceType: "LabOrder",
    resourceId: id,
    req,
  });

  return NextResponse.json({ success: true, order: updated });
});
