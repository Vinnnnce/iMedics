import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  contactName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
});

// GET /api/facility/his/pharmacy/suppliers — supplier directory.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL", "PHARMACY"]);
  const suppliers = await prisma.pharmacySupplier.findMany({
    where: { facilityId: access.facility.id },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, contactName: true, email: true, phone: true,
      notes: true, createdAt: true,
      _count: { select: { orders: true, batches: true } },
    },
  });
  return NextResponse.json({ suppliers });
});

// POST /api/facility/his/pharmacy/suppliers — add a supplier.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL", "PHARMACY"]);
  const body = await parseBody(req, createSchema);
  const supplier = await prisma.pharmacySupplier.create({
    data: {
      facilityId: access.facility.id,
      name: body.name,
      contactName: body.contactName ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      notes: body.notes ?? null,
    },
    select: { id: true, name: true },
  });
  await auditHis(access, "PHARMACY_SUPPLIER_ADDED", "PharmacySupplier", supplier.id, req, { details: { name: body.name } });
  return NextResponse.json({ supplier }, { status: 201 });
});
