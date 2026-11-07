import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { validateInteractionRule } from "@/lib/his/medication-safety";

const createSchema = z.object({
  medicationA: z.string().trim().max(160),
  medicationB: z.string().trim().max(160),
  severity: z.enum(["ADVISORY", "WARNING", "CRITICAL"]),
  description: z.string().trim().min(1).max(500),
});

// GET /api/facility/his/interaction-rules — the facility's configured rules.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req, ["HOSPITAL", "PHARMACY"]);
  const rules = await prisma.medicationInteractionRule.findMany({
    where: { facilityId: access.facility.id },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ rules });
});

// POST /api/facility/his/interaction-rules — configure a rule. Rules are
// hospital-entered data; the engine reports them verbatim and invents nothing.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_FORMULARY", req, ["HOSPITAL", "PHARMACY"]);
  const body = await parseBody(req, createSchema);
  const { medicationA, medicationB, severity } = validateInteractionRule(body.medicationA, body.medicationB, body.severity);
  const existing = await prisma.medicationInteractionRule.findFirst({
    where: {
      facilityId: access.facility.id,
      OR: [
        { medicationA, medicationB },
        { medicationA: medicationB, medicationB: medicationA },
      ],
    },
  });
  if (existing) return NextResponse.json({ error: "A rule for this medication pair already exists" }, { status: 409 });
  const rule = await prisma.medicationInteractionRule.create({
    data: {
      facilityId: access.facility.id,
      medicationA,
      medicationB,
      severity,
      description: body.description,
      createdById: user.id,
    },
  });
  await auditHis(access, "HIS_INTERACTION_RULE_CREATED", "MedicationInteractionRule", rule.id, req, {
    details: { medicationA, medicationB, severity },
  });
  return NextResponse.json({ rule }, { status: 201 });
});
