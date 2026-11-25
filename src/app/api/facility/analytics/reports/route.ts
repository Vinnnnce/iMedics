import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { analyticsAccess, auditAnalytics, describeScope, guardPeriod } from "@/lib/analytics/http";
import { REPORT_CATALOGUE, REPORT_KEYS } from "@/lib/analytics/report";
import { generateReport } from "@/lib/analytics/report-service";
import { COMPARE_MODES, PERIOD_PRESETS } from "@/lib/analytics/periods";
import { assertDashboardAllowed } from "@/lib/analytics/scope";

const bodySchema = z.object({
  reportKey: z.string().refine((k) => (REPORT_KEYS as string[]).includes(k), "Unknown report"),
  preset: z.enum(PERIOD_PRESETS as unknown as [string, ...string[]]).default("LAST_MONTH"),
  compare: z.enum(COMPARE_MODES as unknown as [string, ...string[]]).default("PREVIOUS_PERIOD"),
  from: z.string().optional(), to: z.string().optional(), compareFrom: z.string().optional(), compareTo: z.string().optional(),
});

// GET — the catalogue of reports the caller may generate, and recent generated reports.
export const GET = withAuth(null, async (req, { user }) => {
  const { access, scope } = await analyticsAccess(user, req);
  const catalogue = REPORT_CATALOGUE.map((c) => ({
    category: c.category,
    reports: c.reports.filter((r) => { try { assertDashboardAllowed(scope, r.key); return true; } catch { return false; } }),
  })).filter((c) => c.reports.length);
  const recent = await prisma.analyticsGeneratedReport.findMany({
    where: { facilityId: access.facility.id }, orderBy: { createdAt: "desc" }, take: 30,
    select: { id: true, reportKey: true, title: true, periodStart: true, periodEnd: true, rowCount: true, trigger: true, createdAt: true },
  });
  const visible = recent.filter((r) => catalogue.some((c) => c.reports.some((x) => x.key === r.reportKey)));
  return NextResponse.json({ catalogue, recent: visible });
});

// POST — generate and keep a report for a period.
export const POST = withAuth(null, async (req, { user }) => {
  const { access, scope } = await analyticsAccess(user, req);
  if (scope.departmentIds !== null) throw forbidden("Department-limited access cannot generate reports");
  const body = await parseBody(req, bodySchema);
  const { id, doc } = await guardPeriod(() => generateReport({
    scope, reportKey: body.reportKey as never, scopeNote: describeScope(scope), trigger: "MANUAL", generatedById: user.id,
    range: { preset: body.preset as never, compare: body.compare as never, from: body.from, to: body.to, compareFrom: body.compareFrom, compareTo: body.compareTo },
  }));
  await auditAnalytics(access, "ANALYTICS_REPORT_GENERATED", body.reportKey, { id, period: `${doc.period.startDate}/${doc.period.endDate}` }, req);
  return NextResponse.json({ id, title: doc.title, period: doc.period }, { status: 201 });
}, { rateLimit: RATE_LIMITS.download });
