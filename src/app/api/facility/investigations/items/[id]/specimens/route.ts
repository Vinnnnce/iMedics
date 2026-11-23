import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { conflict, notFound } from "@/lib/errors";
import { requirePerformingFacilityItem } from "@/lib/investigations/access";
import { auditInvestigation, nextAccession, notifySafely, transitionItem } from "@/lib/investigations/service";
import { newRow } from "@/lib/investigations/db";

type Params = { id: string };
const schema = z.object({
  action: z.enum(["collect", "receive", "reject", "recollect"]),
  specimenId: z.string().uuid(),
  reason: z.string().trim().min(3).max(300).optional(),
  notes: z.string().trim().max(300).optional(),
});

// POST /api/facility/investigations/items/[id]/specimens — specimen tracking with barcode/accession,
// documented rejection and recollection (the rejected specimen is kept, the replacement links to it).
export const POST = withAuth<Params>(null, async (req, { user, params }) => {
  const itemId = parseId((await params).id);
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  const { action, specimenId, reason, notes } = await parseBody(req, schema);
  const item = await requirePerformingFacilityItem(itemId, access.facility.id);
  const specimen = await prisma.investigation_specimens.findFirst({ where: { id: specimenId, item_id: itemId, facility_id: access.facility.id } });
  if (!specimen) throw notFound("Specimen not found");
  const actor = { userId: user.id };
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (action === "collect") {
      if (specimen.status !== "PENDING_COLLECTION") throw conflict("This specimen has already been collected");
      await tx.investigation_specimens.update({ where: { id: specimenId }, data: { status: "COLLECTED", collected_at: now, collected_by_id: user.id, notes: notes ?? specimen.notes, updated_at: now } });
      await transitionItem(tx, item, "SAMPLE_COLLECTED", actor, { note: `Specimen ${specimen.accession_number} collected` });
    } else if (action === "receive") {
      if (specimen.status !== "COLLECTED") throw conflict("Only a collected specimen can be received");
      await tx.investigation_specimens.update({ where: { id: specimenId }, data: { status: "RECEIVED", received_at: now, received_by_id: user.id, updated_at: now } });
      await transitionItem(tx, item, "SAMPLE_RECEIVED", actor, { note: `Specimen ${specimen.accession_number} accepted` });
    } else if (action === "reject") {
      if (!["COLLECTED", "RECEIVED"].includes(specimen.status)) throw conflict("Only a collected or received specimen can be rejected");
      if (!reason) throw conflict("A rejection reason is mandatory");
      await tx.investigation_specimens.update({ where: { id: specimenId }, data: { status: "REJECTED", rejection_reason: reason, updated_at: now } });
      await transitionItem(tx, item, "SAMPLE_REJECTED", actor, { note: `Specimen rejected: ${reason}` });
    } else {
      if (specimen.status !== "REJECTED") throw conflict("Only a rejected specimen can be recollected");
      await tx.investigation_specimens.update({ where: { id: specimenId }, data: { status: "RECOLLECTION_REQUESTED", updated_at: now } });
      const { accessionNumber, barcode } = await nextAccession(tx, access.facility.id);
      await tx.investigation_specimens.create({ data: { ...newRow(), item_id: itemId, facility_id: access.facility.id, accession_number: accessionNumber, barcode, specimen_type: specimen.specimen_type, parent_specimen_id: specimen.id } });
      await transitionItem(tx, item, "AWAITING_SAMPLE", actor, { note: "Recollection requested" });
    }
  });
  if (action === "reject" || action === "recollect") await notifySafely([item.investigation_orders.requested_by_id], { kind: "INVESTIGATION_STATUS_CHANGED", orderId: item.order_id });
  await auditInvestigation(user, `INVESTIGATION_SPECIMEN_${action.toUpperCase()}`, itemId, { patientId: item.investigation_orders.patient_id, facilityId: access.facility.id, details: { accession: specimen.accession_number, ...(reason ? { reason } : {}) } });
  return NextResponse.json({ success: true });
});
