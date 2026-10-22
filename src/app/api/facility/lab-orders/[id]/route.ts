import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { assertLabOrderTransition, type LabOrderStatusValue } from "@/lib/modules/workflows";
import { conflict, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications/service";

const actionSchema = z.object({
  action: z.enum([
    "ACCEPT",           // ORDERED -> ACCEPTED (lab confirms it will perform the order)
    "START_PROCESSING", // -> IN_PROGRESS
    "SUBMIT_VERIFICATION", // -> AWAITING_VERIFICATION
    "FINALIZE",         // -> FINALIZED (verified results exist)
    "SEND_TO_HOSPITAL", // FINALIZED/AMENDED -> SENT_TO_FACILITY
    "AMEND",            // FINALIZED/SENT -> AMENDED (reason required)
    "CANCEL",           // -> CANCELLED (reason required)
  ]),
  reason: z.string().trim().max(1000).optional(),
});

const TARGET_STATUS: Record<string, LabOrderStatusValue> = {
  ACCEPT: "ACCEPTED",
  START_PROCESSING: "IN_PROGRESS",
  SUBMIT_VERIFICATION: "AWAITING_VERIFICATION",
  FINALIZE: "FINALIZED",
  SEND_TO_HOSPITAL: "SENT_TO_FACILITY",
  AMEND: "AMENDED",
  CANCEL: "CANCELLED",
};

// PATCH /api/facility/lab-orders/[id] — laboratory workflow actions (Module 02,
// Category 05). Every transition is validated against the state machine and
// the caller's facility permissions; reasons are required where mandated.
// Status changes are conditional updates guarded on the expected previous
// status, so concurrent requests cannot silently overwrite each other.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  await requireFacilityKind(access, ["LABORATORY"]);
  const id = parseId((await params).id);
  const data = await parseBody(req, actionSchema);

  const order = await prisma.labOrder.findFirst({
    where: { id, OR: [{ performingFacilityId: access.facility.id }, { performingFacilityId: null }] },
    select: { id: true, status: true, performingFacilityId: true, requestingFacilityId: true, orderedById: true },
  });
  if (!order) throw notFound("Laboratory order not found");

  const to = TARGET_STATUS[data.action];
  assertLabOrderTransition(order.status, to, access.permissions, data.reason);

  if (data.action === "FINALIZE") {
    // An order can only be finalized when a professional has verified at
    // least one of its results — an unverified or AI-pending result is never
    // a finalized clinical report (spec: Module 02, Category 04).
    const verifiedCount = await prisma.labResult.count({
      where: { labOrderId: id, status: "VERIFIED" },
    });
    if (verifiedCount === 0) {
      throw conflict("This order has no verified results yet — verify the results before finalizing");
    }
  }

  // Claim unassigned legacy orders atomically when the lab acts on them.
  if (!order.performingFacilityId) {
    const claimed = await prisma.labOrder.updateMany({
      where: { id, performingFacilityId: null },
      data: { performingFacilityId: access.facility.id },
    });
    if (claimed.count === 0) throw conflict("This order was just claimed by another laboratory");
  }

  // Conditional update guarded on the status we validated — a concurrent
  // transition (e.g. finalization) cannot be overwritten by a stale request.
  const updated = await prisma.labOrder.updateMany({
    where: { id, status: order.status },
    data: { status: to },
  });
  if (updated.count === 0) {
    throw conflict("This order just changed status — refresh and try again");
  }

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: `LAB_ORDER_${data.action}`,
    resourceType: "LabOrder",
    resourceId: id,
    details: { to, reason: data.reason ?? null },
    req,
  });

  // Notify the requesting hospital / ordering clinician of the status change.
  if (to === "SENT_TO_FACILITY" || to === "FINALIZED") {
    if (order.requestingFacilityId) {
      const owner = await prisma.labStaffProfile.findUnique({
        where: { id: order.requestingFacilityId },
        select: { user: { select: { id: true } } },
      });
      if (owner?.user?.id) {
        await notifyUser(owner.user.id, { kind: "INVESTIGATION_UPDATED", orderId: id }).catch(() => undefined);
      }
    } else if (order.orderedById) {
      await notifyUser(order.orderedById, { kind: "INVESTIGATION_UPDATED", orderId: id }).catch(() => undefined);
    }
  }

  return NextResponse.json({
    success: true,
    order: { id, status: to, requestingFacilityId: order.requestingFacilityId, orderedById: order.orderedById },
  });
});
