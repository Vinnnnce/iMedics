import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const patchSchema = z.object({
  action: z.enum(["deactivate", "reactivate"]),
});

// PATCH /api/facility/his/formulary/[id] — retire or restore a formulary entry.
// Entries are never deleted: history must remain explainable.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL", "PHARMACY"]);
  const id = parseId((await params).id);
  const body = await parseBody(req, patchSchema);
  const item = await prisma.formularyItem.findFirst({ where: { id, facilityId: access.facility.id } });
  if (!item) throw notFound("Formulary entry not found");
  const updated = await prisma.formularyItem.update({
    where: { id },
    data: { active: body.action === "reactivate" },
  });
  await auditHis(access, "HIS_FORMULARY_ITEM_UPDATED", "FormularyItem", id, req, {
    details: { action: body.action },
  });
  return NextResponse.json({ item: updated });
});
