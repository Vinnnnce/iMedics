import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { syncSubaccountCharges } from "@/lib/subaccounts";
import type { ProviderType } from "@prisma/client";

const patchSchema = z.object({
  kind: z.enum(["PERCENT", "FIXED"]).optional(),
  value: z.number().min(0).optional(),
  currency: z.string().length(3).nullable().optional(),
  note: z.string().max(200).nullable().optional(),
  active: z.boolean().optional(),
});

// PATCH /api/admin/commission-rules/[id] — edit or deactivate a rule.
export const PATCH = withAuth<{ id: string }>(["ADMIN"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const data = await parseBody(req, patchSchema);
  const current = await prisma.commissionRule.findUnique({ where: { id } });
  if (!current) throw badRequest("Rule not found");
  const kind = data.kind ?? current.kind;
  if (kind === "PERCENT" && data.value !== undefined && data.value > 100) {
    throw badRequest("A percentage commission cannot exceed 100");
  }
  const rule = await prisma.commissionRule.update({
    where: { id },
    data,
    select: {
      id: true,
      providerType: true,
      facilityId: true,
      kind: true,
      value: true,
      currency: true,
      active: true,
      note: true,
      createdAt: true,
    },
  });
  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "COMMISSION_RULE_UPDATED",
    resourceType: "CommissionRule",
    resourceId: id,
    details: data,
    req,
  });
  if (data.active !== false) {
    await syncSubaccountCharges(rule.providerType as ProviderType, rule.facilityId).catch((error) =>
      console.error("Subaccount sync failed:", error),
    );
  }
  return NextResponse.json({ rule: { ...rule, value: Number(rule.value) } });
});

// DELETE /api/admin/commission-rules/[id] — remove a rule.
export const DELETE = withAuth<{ id: string }>(["ADMIN"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  await prisma.commissionRule.delete({ where: { id } });
  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "COMMISSION_RULE_DELETED",
    resourceType: "CommissionRule",
    resourceId: id,
    req,
  });
  return NextResponse.json({ deleted: true });
});
