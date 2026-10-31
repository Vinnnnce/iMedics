import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { assertPatientLinked, maskIdentifier, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { INSURED, coverageBody, toDates } from "@/lib/his/coverage";
import { badRequest } from "@/lib/errors";

const listSchema = z.object({
  filter: z.enum(["all", "insured", "uninsured", "pending", "authorization", "rejected", "selfpay"]).default("all"),
  patientId: z.string().uuid().optional(),
  includeEnded: z.enum(["1"]).optional(),
});

// GET /api/facility/his/coverage — payer classification dashboard data.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_INSURANCE", req);
  const q = parseQuery(req, listSchema);
  const filter = {
    all: {},
    insured: { category: { in: [...INSURED] } },
    uninsured: { category: "UNINSURED" as const },
    pending: { eligibility: { in: ["NOT_VERIFIED", "PENDING"] as ("NOT_VERIFIED" | "PENDING")[] } },
    authorization: { preauthRequired: true, authorizationNumber: null },
    rejected: { OR: [{ claimStatus: "REJECTED" as const }, { eligibility: "REJECTED" as const }] },
    selfpay: { category: "SELF_PAY" as const },
  }[q.filter];
  if (q.patientId) await assertPatientLinked(access.facility.id, q.patientId);
  const coverages = await prisma.payerCoverage.findMany({
    where: { facilityId: access.facility.id, ...(q.includeEnded ? {} : { active: true }), ...(q.patientId ? { patientId: q.patientId } : {}), ...filter },
    orderBy: [{ updatedAt: "desc" }],
    take: 300,
    include: { patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true } }, verifications: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  const counts = await prisma.payerCoverage.groupBy({ by: ["category"], where: { facilityId: access.facility.id, active: true }, _count: { _all: true } });
  return NextResponse.json({
    coverages: coverages.map((c) => ({ ...c, memberNumber: maskIdentifier(c.memberNumber) })),
    counts: Object.fromEntries(counts.map((c) => [c.category, c._count._all])),
  });
});

// POST /api/facility/his/coverage — record a payer arrangement for a patient of this hospital.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_INSURANCE", req);
  const body = await parseBody(req, coverageBody.extend({ patientId: z.string().uuid() }));
  if (body.coverageStart && body.coverageEnd && body.coverageStart > body.coverageEnd) throw badRequest("Coverage end must not precede its start");
  await assertPatientLinked(access.facility.id, body.patientId);
  const { patientId, ...rest } = body;
  const coverage = await prisma.payerCoverage.create({
    data: {
      ...(toDates(rest) as typeof rest & { coverageStart?: Date }),
      facilityId: access.facility.id, patientId, createdById: user.id,
      eligibility: rest.category === "SELF_PAY" || rest.category === "UNINSURED" ? "VERIFIED" : "NOT_VERIFIED",
      verifications: { create: { eligibility: rest.category === "SELF_PAY" || rest.category === "UNINSURED" ? "VERIFIED" : "NOT_VERIFIED", actorId: user.id, note: "Classification recorded" } },
    } as never,
    select: { id: true },
  });
  await auditHis(access, "HIS_COVERAGE_CREATED", "PayerCoverage", coverage.id, req, { patientId, details: { category: rest.category } });
  return NextResponse.json({ coverage }, { status: 201 });
});
