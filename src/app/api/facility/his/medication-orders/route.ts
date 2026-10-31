import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { assertPatientLinked, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { checkAllergy, checkInteractions } from "@/lib/his/medication-safety";

/** Safety context for a new order: the patient's other active medications,
 *  allergies, the facility's configured rules and the formulary match. */
async function safetyContext(facilityId: string, patientId: string, medicationName: string) {
  const [otherOrders, histories, rules, formulary] = await Promise.all([
    prisma.medicationOrder.findMany({
      where: { facilityId, patientId, status: { in: ["SUBMITTED", "REVIEWED", "DISPENSED", "COMPLETED"] } },
      select: { medicationName: true },
    }),
    prisma.medicalHistory.findMany({ where: { patientId }, select: { allergies: true } }),
    prisma.medicationInteractionRule.findMany({ where: { facilityId, active: true } }),
    prisma.formularyItem.findMany({ where: { facilityId, medicationName, active: true } }),
  ]);
  const allergies = histories.flatMap((h) => (Array.isArray(h.allergies) ? h.allergies : []));
  return {
    otherMedications: otherOrders.map((o) => o.medicationName),
    allergies,
    rules,
    formulary: { matched: formulary.length > 0, highAlert: formulary.some((f) => f.highAlert) },
  };
}

const createSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  medicationName: z.string().trim().min(1).max(160),
  strength: z.string().trim().max(60).optional(),
  dose: z.string().trim().max(100).optional(),
  route: z.string().trim().max(40).optional(),
  frequency: z.string().trim().max(60).optional(),
  duration: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(500).optional(),
});

// GET /api/facility/his/medication-orders?patientId=&status= — order list or
// the facility-wide worklist. Each entry carries the patient's recorded
// allergies so the reviewer sees them; no automatic interaction checking.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const params = new URL(req.url).searchParams;
  const patientId = params.get("patientId") ?? undefined;
  const status = params.get("status") ?? undefined;
  if (patientId) await assertPatientLinked(access.facility.id, patientId);
  const orders = await prisma.medicationOrder.findMany({
    where: {
      facilityId: access.facility.id,
      ...(patientId ? { patientId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true, dateOfBirth: true } },
    },
  });
  // Recorded allergies live on the medical history; surface them for the
  // reviewer's visibility without any automatic interaction checking.
  const patientIds = [...new Set(orders.map((o) => o.patientId))];
  const histories = patientIds.length
    ? await prisma.medicalHistory.findMany({ where: { patientId: { in: patientIds } }, select: { patientId: true, allergies: true } })
    : [];
  const allergiesByPatient = new Map(histories.map((h) => [h.patientId, h.allergies]));
  return NextResponse.json({
    orders: orders.map((o) => ({ ...o, allergies: allergiesByPatient.get(o.patientId) ?? [] })),
  });
});

// POST /api/facility/his/medication-orders — prescribe: creates a DRAFT order
// attributed to the prescriber. This is workflow tooling, not an external
// e-prescribing integration.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "ORDER_MEDICATIONS", req, ["HOSPITAL"]);
  const body = await parseBody(req, createSchema);
  await assertPatientLinked(access.facility.id, body.patientId);
  const safety = await safetyContext(access.facility.id, body.patientId, body.medicationName);
  const allergyAlert = checkAllergy(body.medicationName, safety.allergies);
  const alerts = [
    ...checkInteractions(body.medicationName, safety.otherMedications, safety.rules),
    ...(allergyAlert ? [allergyAlert] : []),
  ];
  const order = await prisma.medicationOrder.create({
    data: {
      facilityId: access.facility.id,
      patientId: body.patientId,
      encounterId: body.encounterId ?? null,
      medicationName: body.medicationName,
      strength: body.strength ?? null,
      dose: body.dose ?? null,
      route: body.route ?? null,
      frequency: body.frequency ?? null,
      duration: body.duration ?? null,
      notes: body.notes ?? null,
      prescriberId: user.id,
      status: "DRAFT",
    },
  });
  await auditHis(access, "HIS_MEDICATION_ORDER_CREATED", "MedicationOrder", order.id, req, {
    patientId: body.patientId,
    details: { medicationName: body.medicationName, status: "DRAFT", alerts: alerts.length },
  });
  // Alerts are advisory: shown to the prescriber, never blocking. The formulary
  // match is informational; the facility configures its own entries.
  return NextResponse.json({ order, alerts, formulary: safety.formulary }, { status: 201 });
});
