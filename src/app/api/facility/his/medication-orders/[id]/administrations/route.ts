import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { validateAdministration } from "@/lib/his/medication-safety";

const createSchema = z.object({
  status: z.enum(["GIVEN", "HELD", "REFUSED", "OMITTED"]),
  administeredDose: z.string().trim().max(100).optional(),
  route: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(500).optional(),
  administeredAt: z.string().datetime().optional(),
});

// POST /api/facility/his/medication-orders/[id]/administrations — record a MAR
// entry against this order. The order must be administrable (not draft or
// cancelled); the entry is attributed and timestamped and never mutates the order.
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "ADMINISTER_MEDICATIONS", req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const body = await parseBody(req, createSchema);
  const order = await prisma.medicationOrder.findFirst({ where: { id, facilityId: access.facility.id } });
  if (!order) throw notFound("Medication order not found");

  validateAdministration(order.status, body.status);
  const administeredAt = body.administeredAt ? new Date(body.administeredAt) : new Date();
  if (Number.isNaN(administeredAt.getTime()) || administeredAt.getTime() > Date.now() + 60_000) {
    return NextResponse.json({ error: "The administration timestamp is not valid" }, { status: 400 });
  }
  if (body.status === "GIVEN" && !body.administeredDose && !order.dose) {
    return NextResponse.json({ error: "Record the dose that was given (or hold/refuse with a reason)" }, { status: 400 });
  }

  const administration = await prisma.medicationAdministration.create({
    data: {
      facilityId: access.facility.id,
      patientId: order.patientId,
      orderId: order.id,
      encounterId: order.encounterId,
      status: body.status,
      administeredDose: body.administeredDose ?? order.dose,
      route: body.route ?? order.route,
      notes: body.notes ?? null,
      administeredById: user.id,
      administeredAt,
    },
  });
  await auditHis(access, "HIS_MEDICATION_ADMINISTERED", "MedicationAdministration", administration.id, req, {
    patientId: order.patientId,
    details: { orderId: order.id, status: body.status },
  });
  return NextResponse.json({ administration }, { status: 201 });
});
