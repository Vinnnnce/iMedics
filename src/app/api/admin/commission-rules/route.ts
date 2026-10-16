import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { syncSubaccountCharges } from "@/lib/subaccounts";
import type { CommissionKind, ProviderType } from "@prisma/client";

const ruleSelect = {
  id: true,
  providerType: true,
  facilityId: true,
  kind: true,
  value: true,
  currency: true,
  active: true,
  note: true,
  createdAt: true,
  facility: { select: { laboratoryName: true, user: { select: { name: true } } } },
} as const;

type RuleRow = {
  id: string;
  providerType: ProviderType;
  facilityId: string | null;
  kind: CommissionKind;
  value: { toString(): string };
  currency: string | null;
  active: boolean;
  note: string | null;
  createdAt: Date;
  facility?: { laboratoryName: string | null; user: { name: string } } | null;
};

const serializeRule = (rule: RuleRow) => ({
  id: rule.id,
  providerType: rule.providerType,
  facilityId: rule.facilityId,
  kind: rule.kind,
  value: Number(rule.value),
  currency: rule.currency,
  active: rule.active,
  note: rule.note,
  createdAt: rule.createdAt,
  facilityName: rule.facility ? rule.facility.laboratoryName || rule.facility.user.name : null,
});

// GET /api/admin/commission-rules — every rule: defaults and facility overrides.
export const GET = withAuth(["ADMIN"], async () => {
  const rules = await prisma.commissionRule.findMany({
    orderBy: [{ providerType: "asc" }, { facilityId: { sort: "desc", nulls: "last" } }],
    select: ruleSelect,
  });
  return NextResponse.json({ rules: rules.map((rule) => serializeRule(rule as RuleRow)) });
});

const createSchema = z.object({
  providerType: z.enum(["DOCTOR", "HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"]),
  facilityId: z.string().uuid().nullable().optional(),
  kind: z.enum(["PERCENT", "FIXED"]),
  value: z.number().min(0),
  currency: z.string().length(3).nullable().optional(),
  note: z.string().max(200).nullable().optional(),
});

// POST /api/admin/commission-rules — add a default rule for a provider type or a facility override.
export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const data = await parseBody(req, createSchema);
  if (data.kind === "PERCENT" && data.value > 100) throw badRequest("A percentage commission cannot exceed 100");

  if (data.facilityId) {
    const facility = await prisma.labStaffProfile.findUnique({
      where: { id: data.facilityId },
      select: { laboratoryName: true, user: { select: { name: true } } },
    });
    if (!facility) throw badRequest("Facility not found");
  } else {
    // Only one active default rule per provider type.
    await prisma.commissionRule.updateMany({
      where: { providerType: data.providerType, facilityId: null },
      data: { active: false },
    });
  }

  const rule = (await prisma.commissionRule.create({
    data: { ...data, facilityId: data.facilityId ?? null, createdById: user.id, active: true },
    select: ruleSelect,
  })) as RuleRow;
  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "COMMISSION_RULE_CREATED",
    resourceType: "CommissionRule",
    resourceId: rule.id,
    details: { ...data, facilityId: data.facilityId ?? null },
    req,
  });
  // Keep existing gateway subaccounts in step with the new percentage.
  await syncSubaccountCharges(data.providerType, data.facilityId ?? null).catch((error) =>
    console.error("Subaccount sync failed:", error),
  );
  return NextResponse.json({ rule: serializeRule(rule) });
});
