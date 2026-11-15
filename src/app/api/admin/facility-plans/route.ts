import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { conflict } from "@/lib/errors";

// GET /api/admin/facility-plans — facility plans including unconfirmed ones (admin only)
export const GET = withAuth(["ADMIN"], async () => {
  const plans = await prisma.subscriptionPlan.findMany({ where: { audience: "FACILITY" }, orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ plans });
});

const planSchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,40}$/, "Use lowercase letters, numbers and dashes"),
  name: z.string().trim().min(2).max(80),
  monthlyPrice: z.number().min(0).max(100_000_000),
  currency: z.string().trim().length(3).default("NGN"),
  sortOrder: z.number().int().min(0).max(100).default(0),
  active: z.boolean().default(true),
  /** Customers can only buy a plan once an admin confirms its price. Omit to leave it as it is. */
  pricingConfirmed: z.boolean().optional(),
});

// POST /api/admin/facility-plans — create or update a facility plan by code. Confirming the first
// plan is what switches on end-of-trial restrictions, so it is a deliberate, audited act.
export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const input = await parseBody(req, planSchema);
  const existing = await prisma.subscriptionPlan.findUnique({ where: { code: input.code } });
  if (existing && existing.audience !== "FACILITY") throw conflict("This code belongs to a doctor plan");
  const previous = ((existing?.features as Record<string, unknown> | null) ?? {});
  const pricingConfirmed = input.pricingConfirmed ?? previous.pricingConfirmed === true;
  const features = { ...previous, pricingConfirmed };
  const data = { name: input.name, monthlyPrice: input.monthlyPrice, currency: input.currency, sortOrder: input.sortOrder, active: input.active, audience: "FACILITY" as const, features };
  const plan = existing
    ? await prisma.subscriptionPlan.update({ where: { code: input.code }, data })
    : await prisma.subscriptionPlan.create({ data: { code: input.code, ...data } });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "ADMIN_FACILITY_PLAN_SAVED", resourceType: "SubscriptionPlan", resourceId: plan.id, details: { code: plan.code, monthlyPrice: input.monthlyPrice, pricingConfirmed, previouslyConfirmed: previous.pricingConfirmed === true, active: input.active }, req });
  return NextResponse.json({ plan }, { status: existing ? 200 : 201 });
});
