import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { conflict, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const createSchema = z.object({
  supplierId: z.string().uuid().optional(),
  reference: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        medicationName: z.string().trim().min(1).max(160),
        strength: z.string().trim().max(60).optional(),
        form: z.string().trim().max(60).optional(),
        quantity: z.number().int().min(1).max(1_000_000),
        unitCost: z.number().min(0).max(1_000_000).optional(),
      }),
    )
    .min(1)
    .max(100),
});

// GET /api/facility/his/pharmacy/purchase-orders — orders with items.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL", "PHARMACY"]);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const orders = await prisma.pharmacyPurchaseOrder.findMany({
    where: { facilityId: access.facility.id, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      supplier: { select: { id: true, name: true } },
      items: true,
      createdBy: { select: { name: true } },
    },
  });
  return NextResponse.json({ orders });
});

// POST /api/facility/his/pharmacy/purchase-orders — create a draft order.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL", "PHARMACY"]);
  const body = await parseBody(req, createSchema);

  if (body.supplierId) {
    const supplier = await prisma.pharmacySupplier.findFirst({
      where: { id: body.supplierId, facilityId: access.facility.id },
      select: { id: true },
    });
    if (!supplier) throw notFound("Supplier not found");
  }

  const order = await prisma.pharmacyPurchaseOrder.create({
    data: {
      facilityId: access.facility.id,
      supplierId: body.supplierId ?? null,
      reference: body.reference ?? null,
      notes: body.notes ?? null,
      createdById: user.id,
      items: {
        create: body.items.map((item) => ({
          medicationName: item.medicationName,
          strength: item.strength ?? null,
          form: item.form ?? null,
          quantity: item.quantity,
          unitCost: item.unitCost ?? null,
        })),
      },
    },
    include: { items: true },
  });
  await auditHis(access, "PHARMACY_ORDER_CREATED", "PharmacyPurchaseOrder", order.id, req, {
    details: { itemCount: body.items.length, supplierId: body.supplierId ?? null },
  });
  return NextResponse.json({ order }, { status: 201 });
});

// PATCH /api/facility/his/pharmacy/purchase-orders?id=... — lifecycle.
// RECEIVING requires batch numbers + expiry dates per item and creates
// the corresponding stock batches (and controlled-register entries).
const patchBodySchema = z.object({
  action: z.enum(["SUBMIT", "RECEIVE", "CANCEL"]),
  reason: z.string().trim().max(500).optional(),
  receipts: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        batchNumber: z.string().trim().min(1).max(80),
        expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        receivedQuantity: z.number().int().min(1).max(1_000_000),
      }),
    )
    .max(100)
    .optional(),
});

export const PATCH = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL", "PHARMACY"]);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) throw notFound("Purchase order not found");
  const body = await parseBody(req, patchBodySchema);

  const order = await prisma.pharmacyPurchaseOrder.findFirst({
    where: { id, facilityId: access.facility.id },
    include: { items: true },
  });
  if (!order) throw notFound("Purchase order not found");

  if (body.action === "SUBMIT") {
    if (order.status !== "DRAFT") throw conflict("Only draft orders can be submitted");
    await prisma.pharmacyPurchaseOrder.update({ where: { id }, data: { status: "SUBMITTED" } });
  } else if (body.action === "CANCEL") {
    if (order.status === "RECEIVED") throw conflict("Order was already received");
    await prisma.pharmacyPurchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  } else if (body.action === "RECEIVE") {
    if (order.status !== "SUBMITTED") throw conflict("Order must be submitted before receiving");
    const receipts = body.receipts ?? [];
    if (receipts.length === 0) throw conflict("Receiving requires batch details for at least one item");
    const itemIds = new Set(order.items.map((i) => i.id));
    for (const r of receipts) {
      if (!itemIds.has(r.itemId)) throw conflict("Receipt references an item not on this order");
    }
    await prisma.$transaction(async (tx) => {
      for (const r of receipts) {
        const item = order.items.find((i) => i.id === r.itemId);
        if (!item) continue;
        await tx.pharmacyPurchaseOrderItem.update({
          where: { id: r.itemId },
          data: { receivedQuantity: { increment: r.receivedQuantity } },
        });
        await tx.pharmacyStockBatch.upsert({
          where: {
            facilityId_medicationName_batchNumber: {
              facilityId: access.facility.id,
              medicationName: item.medicationName,
              batchNumber: r.batchNumber,
            },
          },
          create: {
            facilityId: access.facility.id,
            medicationName: item.medicationName,
            strength: item.strength,
            form: item.form,
            batchNumber: r.batchNumber,
            quantity: r.receivedQuantity,
            unitCost: item.unitCost,
            expiresAt: new Date(`${r.expiresAt}T00:00:00Z`),
            supplierId: order.supplierId,
          },
          update: { quantity: { increment: r.receivedQuantity } },
        });
        const formulary = await tx.formularyItem.findFirst({
          where: { facilityId: access.facility.id, medicationName: item.medicationName, controlled: true },
          select: { controlled: true },
        });
        if (formulary?.controlled) {
          await tx.controlledSubstanceEvent.create({
            data: {
              facilityId: access.facility.id,
              medicationName: item.medicationName,
              eventType: "RECEIVED",
              quantity: r.receivedQuantity,
              unit: item.form ?? "units",
              staffId: user.id,
              reference: `PO ${order.reference ?? order.id.slice(0, 8)} · batch ${r.batchNumber}`,
            },
          });
        }
      }
      await tx.pharmacyPurchaseOrder.update({ where: { id }, data: { status: "RECEIVED" } });
    });
  }

  await auditHis(access, "PHARMACY_ORDER_" + body.action, "PharmacyPurchaseOrder", id, req, {
    details: { reason: body.reason ?? null, receiptCount: body.receipts?.length ?? 0 },
  });
  const updated = await prisma.pharmacyPurchaseOrder.findUniqueOrThrow({
    where: { id },
    include: { items: true },
  });
  return NextResponse.json({ order: updated });
});
