import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { forbidden, notFound } from "@/lib/errors";
import { hasPermission, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { buildEPrescriptionPayload } from "@/lib/his/medication-safety";
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
  const access = await requireHisAccess(user, null, req, ["HOSPITAL", "PHARMACY"]);
  const id = parseId((await params).id);
  const body = await parseBody(req, patchSchema);
  const order = await prisma.medicationOrder.findFirst({
    where: { id, facilityId: access.facility.id },
    include: { patient: { select: { caseNumber: true } } },
  });
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

  // Stock integration: dispensing consumes batches first-expiry-first-out.
  // If no stock is tracked for this medication, dispensing still succeeds
  // (the pharmacy may manage stock outside the platform).
  if (status === "DISPENSED") {
    const dispensed = await prisma.$transaction(async (tx) => {
      const quantity = Math.max(1, Number.parseInt(order.duration ?? "1", 10) || 1);
      let remaining = quantity;
      const batches = await tx.pharmacyStockBatch.findMany({
        where: {
          facilityId: access.facility.id,
          medicationName: order.medicationName,
          quantity: { gt: 0 },
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: "asc" },
      });
      for (const batch of batches) {
        if (remaining <= 0) break;
        const take = Math.min(batch.quantity, remaining);
        await tx.pharmacyStockBatch.update({
          where: { id: batch.id },
          data: { quantity: { decrement: take } },
        });
        remaining -= take;
      }
      // Controlled medicines: every dispense enters the register.
      const formulary = await tx.formularyItem.findFirst({
        where: { facilityId: access.facility.id, medicationName: order.medicationName, controlled: true },
        select: { controlled: true },
      });
      if (formulary?.controlled) {
        await tx.controlledSubstanceEvent.create({
          data: {
            facilityId: access.facility.id,
            medicationName: order.medicationName,
            eventType: "DISPENSED",
            quantity,
            unit: order.strength ?? "units",
            patientId: order.patientId,
            staffId: user.id,
            reference: `Order ${order.id.slice(0, 8)}`,
          },
        });
      }
      return { fullyCovered: remaining <= 0, tracked: batches.length > 0 };
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        facilityId: access.facility.id,
        patientId: order.patientId,
        action: "PHARMACY_STOCK_DISPENSED",
        resourceType: "MedicationOrder",
        resourceId: id,
        details: dispensed,
      },
    });
  }

  // E-prescribing integration boundary: submission enqueues an outbound
  // snapshot. Delivery requires a configured external endpoint; without one the
  // entry stays PENDING as a documented dependency — never a claimed transmission.
  if (status === "SUBMITTED") {
    const payload = buildEPrescriptionPayload({
      orderId: order.id,
      facilityId: access.facility.id,
      patientId: order.patientId,
      caseNumber: order.patient.caseNumber,
      order: {
        medicationName: order.medicationName, strength: order.strength, dose: order.dose, route: order.route,
        frequency: order.frequency, duration: order.duration, notes: order.notes,
        prescriberId: order.prescriberId, status,
      },
    });
    await prisma.ePrescriptionOutbox.create({
      data: { facilityId: access.facility.id, orderId: order.id, status: "PENDING", payload: payload as never },
    });
  }
  await auditHis(access, "HIS_MEDICATION_ORDER_STATUS", "MedicationOrder", id, req, {
    patientId: order.patientId,
    details: { from: order.status, to: status, reason: body.reason ?? null },
  });
  return NextResponse.json({ order: updated });
});
