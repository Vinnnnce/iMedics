import { NextResponse } from "next/server";
import { monitoredCron } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { resolveFacilityPermissions } from "@/lib/facility-auth";
import { buildScope } from "@/lib/analytics/scope";
import { generateReport } from "@/lib/analytics/report-service";
import { nextRunAt, SCHEDULE_PRESET, type Schedule } from "@/lib/analytics/schedule";

/**
 * GET /api/cron/analytics-reports — runs daily. Generates every scheduled report whose time has come,
 * for the period that has just closed, with exactly the rights the template's creator holds today.
 * Header `x-cron-secret` must match CRON_SECRET. A report that can no longer be generated (creator lost
 * access, dashboard no longer available) is paused rather than retried forever.
 */
async function run(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw forbidden("Scheduled analytics reports are not configured");
  if (req.headers.get("x-cron-secret") !== secret) throw forbidden("Invalid cron secret");
  const now = new Date();
  const due = await prisma.analyticsReportDefinition.findMany({ where: { active: true, schedule: { not: "NONE" }, nextRunAt: { lte: now } }, take: 25, orderBy: { nextRunAt: "asc" } });
  let generated = 0, paused = 0;
  for (const def of due) {
    const schedule = def.schedule as Schedule;
    try {
      const [user, facility] = await Promise.all([prisma.user.findUnique({ where: { id: def.createdById } }), prisma.labStaffProfile.findUnique({ where: { id: def.facilityId } })]);
      if (!user || user.status !== "ACTIVE" || !facility) throw new Error("creator or facility unavailable");
      const { permissions } = await resolveFacilityPermissions(user, def.facilityId);
      const staff = await prisma.facilityStaff.findFirst({ where: { userId: user.id, facilityId: def.facilityId }, select: { id: true } });
      const scope = await buildScope({ user, facility, staffId: staff?.id ?? null, permissions });
      if (scope.departmentIds !== null) throw new Error("creator is department-limited");
      await generateReport({ scope, reportKey: def.reportKey as never, range: { preset: SCHEDULE_PRESET[schedule as Exclude<Schedule, "NONE">], compare: "PREVIOUS_PERIOD" }, scopeNote: "Whole facility", trigger: "SCHEDULED", definitionId: def.id, generatedById: user.id, now });
      await prisma.analyticsReportDefinition.update({ where: { id: def.id }, data: { nextRunAt: nextRunAt(schedule, scope.calendar, now) } });
      generated += 1;
    } catch {
      await prisma.analyticsReportDefinition.update({ where: { id: def.id }, data: { active: false, nextRunAt: null } });
      paused += 1;
    }
  }
  await prisma.analyticsSnapshot.deleteMany({ where: { expiresAt: { lt: now } } });
  await writeAudit({ action: "ANALYTICS_REPORTS_DISPATCHED", resourceType: "Analytics", details: { generated, paused, ranAt: now.toISOString() }, req });
  return NextResponse.json({ generated, paused, ranAt: now.toISOString() });
}

export const GET = monitoredCron("analytics-reports", run);
