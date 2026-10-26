import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { conflict, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { coverageBody, toDates } from "@/lib/his/coverage";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), data: coverageBody.partial() }),
  z.object({
    action: z.literal("verify"),
    eligibility: z.enum(["NOT_VERIFIED", "PENDING", "VERIFIED", "REJECTED", "EXPIRED"]),
    claimStatus: z.enum(["NOT_SUBMITTED", "SUBMITTED", "IN_REVIEW", "APPROVED", "PARTIALLY_APPROVED", "REJECTED", "PAID"]).optional(),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("end"), reason: z.string().trim().min(3).max(500) }),
]);

// GET /api/facility/his/coverage/[id] — full record (unmasked member number for insurance staff) with history.
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_INSURANCE", req);
  const coverage = await prisma.payerCoverage.findFirst({
    where: { id: parseId((await params).id), facilityId: access.facility.id },
    include: { verifications: { orderBy: { createdAt: "desc" } }, encounters: { select: { id: true, encounterNumber: true, registeredAt: true } } },
  });
  if (!coverage) throw notFound("Coverage not found");
  await auditHis(access, "HIS_COVERAGE_VIEWED", "PayerCoverage", coverage.id, req, { patientId: coverage.patientId });
  return NextResponse.json({ coverage });
});

// PATCH /api/facility/his/coverage/[id] — update, record a verification, or end the classification.
// Ended classifications are kept; encounters keep the payer that applied at the time.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_INSURANCE", req);
  const id = parseId((await params).id);
  const body = await parseBody(req, schema);
  const coverage = await prisma.payerCoverage.findFirst({ where: { id, facilityId: access.facility.id } });
  if (!coverage) throw notFound("Coverage not found");
  if (!coverage.active) throw conflict("This classification has ended — record a new one instead");

  if (body.action === "update") {
    await prisma.payerCoverage.update({ where: { id }, data: toDates(body.data) as never });
  } else if (body.action === "verify") {
    await prisma.$transaction([
      prisma.payerCoverage.update({ where: { id }, data: { eligibility: body.eligibility, ...(body.claimStatus ? { claimStatus: body.claimStatus } : {}) } }),
      prisma.coverageVerification.create({ data: { coverageId: id, eligibility: body.eligibility, claimStatus: body.claimStatus ?? null, note: body.note ?? null, actorId: user.id } }),
    ]);
  } else {
    await prisma.payerCoverage.update({ where: { id }, data: { active: false, endedAt: new Date(), endedReason: body.reason } });
  }
  await auditHis(access, `HIS_COVERAGE_${body.action.toUpperCase()}`, "PayerCoverage", id, req, { patientId: coverage.patientId });
  return NextResponse.json({ ok: true });
});
