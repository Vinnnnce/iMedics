import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  manufacturer: z.string().trim().max(120).optional(),
  lotNumber: z.string().trim().max(80).optional(),
  quantity: z.number().int().min(0).max(1_000_000),
  unit: z.string().trim().min(1).max(30),
  minStockLevel: z.number().int().min(0).max(1_000_000).optional(),
  expiresAt: z.string().date().optional(),
  storageCondition: z.string().trim().max(120).optional(),
});

// GET /api/facility/his/lab/reagents — reagent inventory with low-stock flags.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "ENTER_RESULTS", req, ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"]);
  const reagents = await prisma.labReagent.findMany({
    where: { facilityId: access.facility.id },
    orderBy: { name: "asc" },
    take: 500,
  });
  const now = new Date();
  return NextResponse.json({
    reagents: reagents.map((r) => ({
      ...r,
      lowStock: r.quantity <= r.minStockLevel,
      expired: r.expiresAt !== null && r.expiresAt < now,
    })),
  });
});

// POST /api/facility/his/lab/reagents — add or update reagent stock.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"]);
  const body = await parseBody(req, createSchema);
  if (body.expiresAt && new Date(`${body.expiresAt}T00:00:00Z`) < new Date()) {
    throw badRequest("Expiry date is in the past");
  }
  const reagent = await prisma.labReagent.create({
    data: {
      facilityId: access.facility.id,
      name: body.name,
      manufacturer: body.manufacturer ?? null,
      lotNumber: body.lotNumber ?? null,
      quantity: body.quantity,
      unit: body.unit,
      minStockLevel: body.minStockLevel ?? 0,
      expiresAt: body.expiresAt ? new Date(`${body.expiresAt}T00:00:00Z`) : null,
      storageCondition: body.storageCondition ?? null,
    },
    select: { id: true, name: true },
  });
  await auditHis(access, "LAB_REAGENT_ADDED", "LabReagent", reagent.id, req, { details: { name: body.name, quantity: body.quantity } });
  return NextResponse.json({ reagent }, { status: 201 });
});
