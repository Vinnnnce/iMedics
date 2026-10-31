import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const patchSchema = z.object({ action: z.enum(["deactivate", "reactivate"]) });

// PATCH /api/facility/his/interaction-rules/[id] — retire or restore a rule.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const body = await parseBody(req, patchSchema);
  const rule = await prisma.medicationInteractionRule.findFirst({ where: { id, facilityId: access.facility.id } });
  if (!rule) throw notFound("Interaction rule not found");
  const updated = await prisma.medicationInteractionRule.update({
    where: { id },
    data: { active: body.action === "reactivate" },
  });
  await auditHis(access, "HIS_INTERACTION_RULE_UPDATED", "MedicationInteractionRule", id, req, {
    details: { action: body.action },
  });
  return NextResponse.json({ rule: updated });
});
