import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, forbidden } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { analyticsAccess, auditAnalytics } from "@/lib/analytics/http";
import { assertDashboardAllowed } from "@/lib/analytics/scope";
import { REPORT_KEYS } from "@/lib/analytics/report";
import { nextRunAt, SCHEDULES } from "@/lib/analytics/schedule";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  reportKey: z.string().refine((k) => (REPORT_KEYS as string[]).includes(k), "Unknown report"),
  schedule: z.enum(SCHEDULES).default("NONE"),
});

// GET — saved report templates (optionally scheduled).
export const GET = withAuth(null, async (req, { user }) => {
  const { access } = await analyticsAccess(user, req);
  const defs = await prisma.analyticsReportDefinition.findMany({ where: { facilityId: access.facility.id }, orderBy: { name: "asc" } });
  return NextResponse.json({ definitions: defs.map((d) => ({ id: d.id, name: d.name, reportKey: d.reportKey, schedule: d.schedule, nextRunAt: d.nextRunAt, active: d.active })) });
});

// POST — save a report template, and schedule weekly/monthly/quarterly/annual generation.
export const POST = withAuth(null, async (req, { user }) => {
  const { access, scope } = await analyticsAccess(user, req);
  if (scope.departmentIds !== null) throw forbidden("Department-limited access cannot save report templates");
  const body = await parseBody(req, createSchema);
  assertDashboardAllowed(scope, body.reportKey as never);
  if ((await prisma.analyticsReportDefinition.count({ where: { facilityId: access.facility.id, active: true } })) >= 50) throw badRequest("A facility can keep at most 50 active report templates");
  const def = await prisma.analyticsReportDefinition.create({
    data: { facilityId: access.facility.id, name: body.name, reportKey: body.reportKey, schedule: body.schedule, nextRunAt: nextRunAt(body.schedule, scope.calendar, new Date()), createdById: user.id },
  });
  await auditAnalytics(access, "ANALYTICS_REPORT_TEMPLATE_SAVED", body.reportKey, { id: def.id, schedule: body.schedule }, req);
  return NextResponse.json({ id: def.id }, { status: 201 });
});

// DELETE — stop and remove a template (?id=…).
export const DELETE = withAuth(null, async (req, { user }) => {
  const { access } = await analyticsAccess(user, req);
  const id = z.string().uuid().parse(new URL(req.url).searchParams.get("id"));
  const res = await prisma.analyticsReportDefinition.deleteMany({ where: { id, facilityId: access.facility.id } });
  await auditAnalytics(access, "ANALYTICS_REPORT_TEMPLATE_REMOVED", id, { removed: res.count }, req);
  return NextResponse.json({ removed: res.count });
});
