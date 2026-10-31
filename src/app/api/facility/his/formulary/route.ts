import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const createSchema = z.object({
  medicationName: z.string().trim().min(1).max(160),
  strength: z.string().trim().max(60).optional(),
  form: z.string().trim().max(60).optional(),
  defaultRoute: z.string().trim().max(40).optional(),
  highAlert: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
});

// GET /api/facility/his/formulary?active=1 — the facility formulary.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const params = new URL(req.url).searchParams;
  const items = await prisma.formularyItem.findMany({
    where: {
      facilityId: access.facility.id,
      ...(params.get("active") === "1" ? { active: true } : {}),
    },
    orderBy: { medicationName: "asc" },
    take: 500,
  });
  return NextResponse.json({ items });
});

// POST /api/facility/his/formulary — add a formulary entry (pharmacy-configured;
// the application makes no clinical claim about any entry).
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL"]);
  const body = await parseBody(req, createSchema);
  const existing = await prisma.formularyItem.findFirst({
    where: { facilityId: access.facility.id, medicationName: body.medicationName, strength: body.strength ?? null },
  });
  if (existing) return NextResponse.json({ error: "This medication and strength is already in the formulary" }, { status: 409 });
  const item = await prisma.formularyItem.create({
    data: {
      facilityId: access.facility.id,
      medicationName: body.medicationName,
      strength: body.strength ?? null,
      form: body.form ?? null,
      defaultRoute: body.defaultRoute ?? null,
      highAlert: body.highAlert ?? false,
      notes: body.notes ?? null,
      createdById: user.id,
    },
  });
  await auditHis(access, "HIS_FORMULARY_ITEM_CREATED", "FormularyItem", item.id, req, {
    details: { medicationName: body.medicationName, highAlert: body.highAlert ?? false },
  });
  return NextResponse.json({ item }, { status: 201 });
});
