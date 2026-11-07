import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, notFound } from "@/lib/errors";
import { hasPermission, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

/**
 * Pharmacy stock inventory (Module 04). Stock is held in batches (lots) with
 * expiry dates; dispensing consumes batches first-expiry-first-out.
 */

const receiveSchema = z.object({
  medicationName: z.string().trim().min(1).max(160),
  strength: z.string().trim().max(60).optional(),
  form: z.string().trim().max(60).optional(),
  batchNumber: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(1_000_000),
  unitCost: z.number().min(0).max(1_000_000).optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplierId: z.string().uuid().optional(),
  notes: z.string().trim().max(500).optional(),
});

// GET /api/facility/his/pharmacy/inventory — stock batches + summary.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, null, req, ["HOSPITAL", "PHARMACY"]);
  if (!hasPermission(access, "MANAGE_FORMULARY") && !hasPermission(access, "REVIEW_MEDICATIONS")) {
    throw notFound("Not found");
  }
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter"); // low | expiring | expired

  const now = new Date();
  const batches = await prisma.pharmacyStockBatch.findMany({
    where: { facilityId: access.facility.id },
    orderBy: [{ medicationName: "asc" }, { expiresAt: "asc" }],
    take: 500,
  });

  let rows = batches;
  if (filter === "expired") rows = batches.filter((b) => b.expiresAt < now);
  else if (filter === "expiring") rows = batches.filter((b) => b.expiresAt >= now && b.expiresAt < new Date(now.getTime() + 90 * 86_400_000));
  else if (filter === "low") {
    // Aggregate per medication and compare against a nominal 10-unit floor
    // or any single batch below 5 units.
    const totals = new Map<string, number>();
    for (const b of batches) {
      totals.set(b.medicationName, (totals.get(b.medicationName) ?? 0) + b.quantity);
    }
    rows = batches.filter((b) => b.quantity < 5 || (totals.get(b.medicationName) ?? 0) < 10);
  }

  const totalUnits = batches.reduce((sum, b) => sum + b.quantity, 0);
  const totalValue = batches.reduce((sum, b) => sum + (b.unitCost ? b.unitCost.toNumber() * b.quantity : 0), 0);

  return NextResponse.json({
    batches: rows,
    summary: {
      totalBatches: batches.length,
      totalUnits,
      totalValue,
      expired: batches.filter((b) => b.expiresAt < now).length,
      expiring90Days: batches.filter((b) => b.expiresAt >= now && b.expiresAt < new Date(now.getTime() + 90 * 86_400_000)).length,
    },
  });
});

// POST /api/facility/his/pharmacy/inventory — receive a stock batch.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL", "PHARMACY"]);
  const body = await parseBody(req, receiveSchema);
  const expiresAt = new Date(`${body.expiresAt}T00:00:00Z`);
  if (expiresAt < new Date()) throw badRequest("Expiry date is in the past");

  if (body.supplierId) {
    const supplier = await prisma.pharmacySupplier.findFirst({
      where: { id: body.supplierId, facilityId: access.facility.id },
      select: { id: true },
    });
    if (!supplier) throw notFound("Supplier not found");
  }

  const batch = await prisma.$transaction(async (tx) => {
    const row = await tx.pharmacyStockBatch.upsert({
      where: {
        facilityId_medicationName_batchNumber: {
          facilityId: access.facility.id,
          medicationName: body.medicationName,
          batchNumber: body.batchNumber,
        },
      },
      create: {
        facilityId: access.facility.id,
        medicationName: body.medicationName,
        strength: body.strength ?? null,
        form: body.form ?? null,
        batchNumber: body.batchNumber,
        quantity: body.quantity,
        unitCost: body.unitCost ?? null,
        expiresAt,
        supplierId: body.supplierId ?? null,
        notes: body.notes ?? null,
      },
      update: {
        quantity: { increment: body.quantity },
        expiresAt,
        unitCost: body.unitCost ?? undefined,
        notes: body.notes ?? undefined,
      },
    });
    // Controlled medicines: receipt must enter the register.
    const formulary = await tx.formularyItem.findFirst({
      where: { facilityId: access.facility.id, medicationName: body.medicationName, controlled: true },
      select: { controlled: true },
    });
    if (formulary?.controlled) {
      await tx.controlledSubstanceEvent.create({
        data: {
          facilityId: access.facility.id,
          medicationName: body.medicationName,
          eventType: "RECEIVED",
          quantity: body.quantity,
          unit: body.form ?? "units",
          staffId: user.id,
          reference: `Batch ${body.batchNumber}`,
          notes: body.notes ?? null,
        },
      });
    }
    return row;
  });

  await auditHis(access, "PHARMACY_STOCK_RECEIVED", "PharmacyStockBatch", batch.id, req, {
    details: { medicationName: body.medicationName, batchNumber: body.batchNumber, quantity: body.quantity },
  });
  return NextResponse.json({ batch }, { status: 201 });
});
