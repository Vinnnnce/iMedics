import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { badRequest, conflict } from "@/lib/errors";
import { requirePerformingFacilityItem } from "@/lib/investigations/access";
import { RESULT_GATED_STATUSES } from "@/lib/investigations/workflow";
import { newRow, touch } from "@/lib/investigations/db";
import { auditInvestigation, nextAccession, notifySafely, recordStatus, refreshOrderStatus, transitionItem } from "@/lib/investigations/service";

type Params = { id: string };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("advance"), to: z.enum(["AWAITING_SAMPLE", "ASSIGNED_TO_SECTION", "PROCESSING", "ANALYSIS_COMPLETED", "AWAITING_APPOINTMENT", "APPOINTMENT_SCHEDULED", "PATIENT_PREPARATION", "CHECKED_IN", "EXAM_IN_PROGRESS", "EXAM_COMPLETED", "MEDIA_UPLOADED", "AWAITING_INTERPRETATION", "CANCELLED"]), note: z.string().trim().max(500).optional(), scheduledAt: z.coerce.date().optional(), schedulingNotes: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("decline"), reason: z.string().trim().min(5).max(500) }),
  z.object({ action: z.literal("assign"), assignedToId: z.string().uuid().nullable() }),
]);

const NOTIFY_DOCTOR = new Set(["AWAITING_SAMPLE", "APPOINTMENT_SCHEDULED", "SAMPLE_REJECTED", "CANCELLED", "EXAM_COMPLETED"]);

// POST /api/facility/investigations/items/[id]/advance — move an item along its department workflow.
// Result entry, verification, signing and release have their own permissioned endpoint.
export const POST = withAuth<Params>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  const body = await parseBody(req, schema);
  const item = await requirePerformingFacilityItem(id, access.facility.id);
  const actor = { userId: user.id };

  if (body.action === "assign") {
    await prisma.investigation_order_items.update({ where: { id }, data: { assigned_to_id: body.assignedToId, ...touch() } });
    return NextResponse.json({ success: true });
  }

  if (body.action === "decline") {
    // The facility cannot perform this service: the doctor is told and can refer it elsewhere. Never silently dropped.
    if (item.status !== "NEW_REQUEST") throw conflict("Only a new request can be declined");
    const requesterId = item.investigation_orders.requested_by_id;
    await prisma.$transaction(async (tx) => {
      await tx.investigation_referrals.create({ data: { ...newRow(), item_id: id, from_facility_id: access.facility.id, to_facility_id: access.facility.id, status: "DECLINED", reason: body.reason, requested_by_id: requesterId, responded_by_id: user.id, responded_at: new Date() } });
      await tx.investigation_order_items.update({ where: { id }, data: { performing_facility_id: null, status: "REFERRAL_PENDING", status_changed_at: new Date(), ...touch() } });
      await recordStatus(tx, id, item.status, "REFERRAL_PENDING", actor, `Declined by the facility: ${body.reason}`);
      await refreshOrderStatus(tx, item.order_id);
    });
    await notifySafely([requesterId], { kind: "INVESTIGATION_STATUS_CHANGED", orderId: item.order_id });
    await auditInvestigation(user, "INVESTIGATION_DECLINED", id, { patientId: item.investigation_orders.patient_id, facilityId: access.facility.id, details: { reason: body.reason } });
    return NextResponse.json({ success: true });
  }

  if (RESULT_GATED_STATUSES.includes(body.to)) throw badRequest("Use the result endpoint for this step");
  if (body.to === "MEDIA_UPLOADED" && (await prisma.investigation_media.count({ where: { item_id: id } })) === 0) throw badRequest("Upload at least one image or recording first");
  if (body.to === "APPOINTMENT_SCHEDULED" && (!body.scheduledAt || body.scheduledAt.getTime() < Date.now() - 60_000)) throw badRequest("Choose a future appointment date and time");
  if (body.to === "ASSIGNED_TO_SECTION" && (await prisma.investigation_specimens.count({ where: { item_id: id, status: "RECEIVED" } })) === 0) throw conflict("Receive the specimen before assigning it to a section");

  await prisma.$transaction(async (tx) => {
    await transitionItem(tx, item, body.to, actor, {
      note: body.note,
      data: body.to === "APPOINTMENT_SCHEDULED" ? { scheduled_at: body.scheduledAt, scheduling_notes: body.schedulingNotes ?? null } : body.to === "CANCELLED" ? { cancel_reason: body.note ?? "Cancelled by facility" } : undefined,
    });
    if (body.to === "AWAITING_SAMPLE" && item.domain === "LABORATORY") {
      const existing = await tx.investigation_specimens.count({ where: { item_id: id, status: { in: ["PENDING_COLLECTION", "COLLECTED", "RECEIVED"] } } });
      if (!existing) {
        const { accessionNumber, barcode } = await nextAccession(tx, access.facility.id);
        await tx.investigation_specimens.create({ data: { ...newRow(), item_id: id, facility_id: access.facility.id, accession_number: accessionNumber, barcode, specimen_type: item.specimen_type } });
      }
    }
  });
  if (NOTIFY_DOCTOR.has(body.to)) await notifySafely([item.investigation_orders.requested_by_id], { kind: "INVESTIGATION_STATUS_CHANGED", orderId: item.order_id });
  await auditInvestigation(user, "INVESTIGATION_STATUS_CHANGED", id, { patientId: item.investigation_orders.patient_id, facilityId: access.facility.id, details: { from: item.status, to: body.to } });
  return NextResponse.json({ success: true });
});
