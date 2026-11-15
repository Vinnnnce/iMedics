import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { deliverEPrescription } from "@/lib/his/medication-safety";

// GET /api/facility/his/eprescribing — the outbound integration queue. Entries
// stay PENDING until an external endpoint is configured (EPRESCRIBING_ENDPOINT);
// that dependency is displayed, never hidden. No live transmission is claimed.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "REVIEW_MEDICATIONS", req, ["HOSPITAL", "PHARMACY"]);
  const entries = await prisma.ePrescriptionOutbox.findMany({
    where: { facilityId: access.facility.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const orderIds = [...new Set(entries.map((entry) => entry.orderId).filter(Boolean))];
  const orders = orderIds.length
    ? await prisma.medicationOrder.findMany({
        where: { id: { in: orderIds }, facilityId: access.facility.id },
        select: { id: true, medicationName: true, patientId: true, status: true },
      })
    : [];
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  return NextResponse.json({
    outbox: entries.map((entry) => ({ ...entry, order: ordersById.get(entry.orderId) ?? null })),
    endpointConfigured: Boolean(process.env.EPRESCRIBING_ENDPOINT),
  });
});

// POST /api/facility/his/eprescribing — attempt delivery of pending entries.
// Requires REVIEW_MEDICATIONS. Each attempt updates attempts/lastError and,
// on success, stamps sentAt and marks SENT.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "REVIEW_MEDICATIONS", req, ["HOSPITAL", "PHARMACY"]);
  const pending = await prisma.ePrescriptionOutbox.findMany({
    where: { facilityId: access.facility.id, status: "PENDING" },
    take: 50,
  });
  let delivered = 0, stillPending = 0;
  for (const entry of pending) {
    const result = await deliverEPrescription(process.env.EPRESCRIBING_ENDPOINT, entry.payload as never);
    if (result.delivered) {
      await prisma.ePrescriptionOutbox.update({ where: { id: entry.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      delivered++;
    } else {
      await prisma.ePrescriptionOutbox.update({
        where: { id: entry.id },
        data: { attempts: entry.attempts + 1, lastError: result.error ?? "Delivery failed" },
      });
      stillPending++;
    }
  }
  await auditHis(access, "HIS_EPRESCRIBING_DISPATCH", "EPrescriptionOutbox", null, req, {
    details: { attempted: pending.length, delivered, stillPending, endpointConfigured: Boolean(process.env.EPRESCRIBING_ENDPOINT) },
  });
  return NextResponse.json({
    attempted: pending.length, delivered, stillPending,
    endpointConfigured: Boolean(process.env.EPRESCRIBING_ENDPOINT),
  });
});
