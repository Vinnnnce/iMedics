import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { recentRuns, runDailyReconciliation } from "@/lib/reconciliation";
import { writeAudit } from "@/lib/audit";

const querySchema = z.object({
  runId: z.string().uuid().optional(),
});

// GET /api/admin/reconciliation — recent runs (with open discrepancies) or one run's findings.
export const GET = withAuth(["ADMIN"], async (req) => {
  const { runId } = parseQuery(req, querySchema);
  if (runId) {
    const run = await prisma.reconciliationRun.findUnique({
      where: { id: runId },
      include: { discrepancies: { orderBy: { createdAt: "asc" } } },
    });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    return NextResponse.json({
      run: {
        ...run,
        localAmountMinor: Number(run.localAmountMinor),
        gatewayAmountMinor: Number(run.gatewayAmountMinor),
        discrepancies: run.discrepancies.map((d) => ({ ...d, resolvedAt: d.resolvedAt })),
      },
    });
  }
  return NextResponse.json({ runs: await recentRuns() });
});

const runSchema = z.object({
  /** ISO date for the day to reconcile; defaults to yesterday (the daily job's window). */
  date: z.string().date().optional(),
});

// POST /api/admin/reconciliation — run the comparison now (the scheduled job does this daily).
export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const { date } = await parseBody(req, runSchema);
  const target = date ? new Date(`${date}T00:00:00Z`) : new Date(Date.now() - 86_400_000);
  const result = await runDailyReconciliation(target);
  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "RECONCILIATION_RUN",
    resourceType: "ReconciliationRun",
    resourceId: result.runId,
    details: { date: result.date, discrepancies: result.discrepancies },
    req,
  });
  return NextResponse.json({ result });
});

const resolveSchema = z.object({ id: z.string().uuid() });

// PATCH /api/admin/reconciliation — mark a finding as handled.
export const PATCH = withAuth(["ADMIN"], async (req, { user }) => {
  const { id } = await parseBody(req, resolveSchema);
  await prisma.reconciliationDiscrepancy.update({ where: { id }, data: { resolvedAt: new Date() } });
  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "RECONCILIATION_DISCREPANCY_RESOLVED",
    resourceType: "ReconciliationDiscrepancy",
    resourceId: id,
    req,
  });
  return NextResponse.json({ resolved: true });
});
