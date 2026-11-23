import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireDoctorOrderAccess } from "@/lib/investigations/access";
import { notFound } from "@/lib/errors";
import { auditInvestigation } from "@/lib/investigations/service";
import { newId } from "@/lib/investigations/db";

type Params = { id: string };
const schema = z.object({
  note: z.string().trim().min(3).max(4000),
  followUpTitle: z.string().trim().min(3).max(200).optional(),
  followUpDueAt: z.coerce.date().optional(),
});

// POST /api/investigations/items/[id]/interpretation — a doctor's interpretation of a RELEASED result,
// with an optional follow-up task, recorded against the patient's case.
export const POST = withAuth<Params>(["DOCTOR"], async (req, { user, params }) => {
  const itemId = parseId((await params).id);
  const body = await parseBody(req, schema);
  const item = await prisma.investigation_order_items.findUnique({ where: { id: itemId }, select: { id: true, order_id: true, investigation_orders: { select: { patient_id: true, case_id: true } } } });
  if (!item) throw notFound("Investigation not found");
  await requireDoctorOrderAccess(user, item.order_id, { write: true });
  const released = await prisma.investigation_results.findFirst({ where: { item_id: itemId, status: "RELEASED" }, orderBy: { version: "desc" }, select: { id: true } });
  if (!released) throw notFound("No released report to interpret");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.investigation_interpretations.create({ data: { id: newId(), result_id: released.id, doctor_user_id: user.id, note: body.note, follow_up_title: body.followUpTitle ?? null, follow_up_due_at: body.followUpDueAt ?? null } });
    const caseId = item.investigation_orders.case_id;
    if (caseId) {
      // Update the clinical case timeline without changing its status.
      const c = await tx.careCase.findUnique({ where: { id: caseId }, select: { status: true } });
      if (c) await tx.careCaseEvent.create({ data: { caseId, status: c.status, note: body.followUpTitle ? `Investigation interpreted; follow-up: ${body.followUpTitle}` : "Investigation interpretation recorded", actorId: user.id } });
    }
    return row;
  });
  await auditInvestigation(user, "INVESTIGATION_INTERPRETED", itemId, { patientId: item.investigation_orders.patient_id });
  return NextResponse.json({ success: true, id: created.id }, { status: 201 });
});
