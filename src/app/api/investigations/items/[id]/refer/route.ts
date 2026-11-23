import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { computeDueAt, facilitiesOffering, facilityRecipients, notifySafely, recordStatus, refreshOrderStatus, auditInvestigation } from "@/lib/investigations/service";
import { newRow, touch } from "@/lib/investigations/db";

type Params = { id: string };

// POST /api/investigations/items/[id]/refer — the requesting doctor sends an item that has no facility yet, or whose
// facility declined it, to another participating facility. The referral is tracked until the report returns.
export const POST = withAuth<Params>(["DOCTOR"], async (req, { user, params }) => {
  const itemId = parseId((await params).id);
  const { toFacilityId, reason } = await parseBody(req, z.object({ toFacilityId: z.string().uuid(), reason: z.string().trim().max(500).optional() }));
  const item = await prisma.investigation_order_items.findFirst({ where: { id: itemId, investigation_orders: { requested_by_id: user.id } }, include: { investigation_orders: { select: { id: true, patient_id: true } } } });
  if (!item) throw notFound("Investigation not found");
  if (!["REFERRAL_PENDING", "NEW_REQUEST"].includes(item.status)) throw conflict("This investigation has already been accepted by a facility");

  let departmentKey = item.department_key;
  let tat: number | null = null;
  if (item.catalogue_item_id) {
    const offers = (await facilitiesOffering([item.catalogue_item_id], item.domain)).get(item.catalogue_item_id) ?? [];
    const match = offers.find((o) => o.facilityId === toFacilityId);
    if (!match) throw badRequest("That facility does not offer this investigation");
    departmentKey = match.departmentKey ?? departmentKey;
    tat = match.turnaroundMinutes;
  } else {
    const ok = await prisma.labStaffProfile.findFirst({ where: { id: toFacilityId, verificationStatus: "VERIFIED" }, select: { id: true } });
    if (!ok) throw badRequest("That facility is not available");
  }

  await prisma.$transaction(async (tx) => {
    await tx.investigation_referrals.create({ data: { ...newRow(), item_id: itemId, from_facility_id: item.performing_facility_id, to_facility_id: toFacilityId, reason: reason ?? null, requested_by_id: user.id } });
    await tx.investigation_order_items.update({ where: { id: itemId }, data: { performing_facility_id: toFacilityId, department_key: departmentKey, status: "NEW_REQUEST", status_changed_at: new Date(), due_at: computeDueAt(item.domain, item.priority, tat, null), ...touch() } });
    await recordStatus(tx, itemId, item.status, "NEW_REQUEST", { userId: user.id }, `Referred to another facility${reason ? `: ${reason}` : ""}`);
    await refreshOrderStatus(tx, item.order_id);
  });
  await notifySafely(await facilityRecipients(toFacilityId), { kind: "INVESTIGATION_ORDER_RECEIVED", orderId: item.order_id });
  await auditInvestigation(user, "INVESTIGATION_REFERRED", itemId, { patientId: item.investigation_orders.patient_id, facilityId: toFacilityId });
  return NextResponse.json({ success: true });
});
