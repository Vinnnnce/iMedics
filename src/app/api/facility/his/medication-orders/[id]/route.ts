import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { forbidden, notFound } from "@/lib/errors";
import { hasPermission, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { validateMedicationTransition, transitionRequiresReview, type MedicationStatus } from "@/lib/his/nursing";

const patchSchema = z.object({
  status: z.enum(["SUBMITTED", "REVIEWED", "DISPENSED", "COMPLETED", "CANCELLED"]),
  reason: z.string().trim().max(500).optional(),
});

// PATCH /api/facility/his/medication-orders/[id] — pharmacy workflow transitions.
// Prescribers move DRAFT → SUBMITTED and may cancel their own order; reviewing
// and dispensing require the pharmacy permission. Every move is audited with
// its reason; the order snapshot (prescriber, patient, medication) never changes.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, null, req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const body = await parseBody(req, patchSchema);
  const order = await prisma.medicationOrder.findFirst({ where: { id, facilityId: access.facility.id } });
  if (!order) throw notFound("Medication order not found");

  const status = body.status as MedicationStatus;
  // Permission gates first: unauthorized callers must not learn workflow state.
  if (status === "SUBMITTED" && !hasPermission(access, "ORDER_MEDICATIONS")) {
    throw forbidden("Submitting a medication order requires the prescribing permission");
  }
  if (transitionRequiresReview(status) && !hasPermission(access, "REVIEW_MEDICATIONS")) {
    throw forbidden("Reviewing and dispensing medication requires the pharmacy permission");
  }
  if (status === "CANCELLED" && order.prescriberId !== user.id) {
    throw forbidden("Only the prescriber can cancel this order");
  }
  validateMedicationTransition(order.status, body.status);

  const now = new Date();
  const updated = await prisma.medicationOrder.update({
    where: { id },
    data: {
      status,
      ...(status === "REVIEWED" ? { reviewedById: user.id } : {}),
      ...(status === "DISPENSED" ? { dispensedAt: now } : {}),
    },
  });
  await auditHis(access, "HIS_MEDICATION_ORDER_STATUS", "MedicationOrder", id, req, {
    patientId: order.patientId,
    details: { from: order.status, to: status, reason: body.reason ?? null },
  });
  return NextResponse.json({ order: updated });
});
