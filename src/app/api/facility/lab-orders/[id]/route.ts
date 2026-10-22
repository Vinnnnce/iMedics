import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { assertLabOrderTransition, type LabOrderStatusValue } from "@/lib/modules/workflows";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications/service";

const actionSchema = z.object({
  action: z.enum([
    "ACCEPT",           // ORDERED -> ACCEPTED (lab confirms it will perform the order)
    "START_PROCESSING", // -> IN_PROGRESS
    "SUBMIT_VERIFICATION", // -> AWAITING_VERIFICATION
    "FINALIZE",         // -> FINALIZED (verified results)
    "SEND_TO_HOSPITAL", // FINALIZED/AMENDED -> SENT_TO_FACILITY
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
  CANCEL: "CANCELLED",
};

// PATCH /api/facility/lab-orders/[id] — laboratory workflow actions (Module 02,
// Category 05). Every transition is validated against the state machine and
// the caller's facility permissions; reasons are required where mandated.
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

  // Claim unassigned legacy orders when the lab acts on them.
  const updated = await prisma.labOrder.update({
    where: { id },
    data: {
      status: to,
      ...(order.performingFacilityId ? {} : { performingFacilityId: access.facility.id }),
    },
    select: { id: true, status: true, requestingFacilityId: true, orderedById: true },
  });

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
    if (updated.requestingFacilityId) {
      const owner = await prisma.labStaffProfile.findUnique({
        where: { id: updated.requestingFacilityId },
        select: { user: { select: { id: true } } },
      });
      if (owner?.user?.id) {
        await notifyUser(owner.user.id, { kind: "INVESTIGATION_UPDATED", orderId: id }).catch(() => undefined);
      }
    } else if (updated.orderedById) {
      await notifyUser(updated.orderedById, { kind: "INVESTIGATION_UPDATED", orderId: id }).catch(() => undefined);
    }
  }

  return NextResponse.json({ success: true, order: updated });
});
