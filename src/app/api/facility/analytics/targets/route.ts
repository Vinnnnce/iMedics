import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, forbidden } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { analyticsAccess, auditAnalytics } from "@/lib/analytics/http";
import { getMetric } from "@/lib/analytics/registry";

const putSchema = z.object({
  metricKey: z.string().min(1).max(80),
  departmentId: z.string().uuid().nullish(),
  targetValue: z.number().finite().min(0).max(1_000_000),
  direction: z.enum(["AT_LEAST", "AT_MOST"]).optional(),
  note: z.string().trim().max(300).nullish(),
});

function requireManager(permissions: readonly string[]) {
  if (!permissions.includes("MANAGE_HOSPITAL_SETTINGS")) throw forbidden("Setting targets needs the manage-settings permission");
}

// GET — the facility's targets.
export const GET = withAuth(null, async (req, { user }) => {
  const { access } = await analyticsAccess(user, req);
  const rows = await prisma.analyticsPerformanceTarget.findMany({ where: { facilityId: access.facility.id }, orderBy: [{ metricKey: "asc" }, { scopeKey: "asc" }] });
  return NextResponse.json({ targets: rows.map((r) => ({ id: r.id, metricKey: r.metricKey, departmentId: r.departmentId, targetValue: Number(r.targetValue), direction: r.direction, note: r.note, updatedAt: r.updatedAt })) });
});

// PUT — create or update one target (facility-wide, or for one department).
export const PUT = withAuth(null, async (req, { user }) => {
  const { access, scope } = await analyticsAccess(user, req);
  requireManager(scope.permissions);
  const body = await parseBody(req, putSchema);
  const metric = getMetric(body.metricKey);
  if (!metric || !metric.targetable) throw badRequest("That metric cannot have a target");
  if (metric.requires && !scope.permissions.includes(metric.requires)) throw forbidden("Your role does not allow targets on this metric");
  const direction = body.direction ?? (metric.betterWhen === "LOWER" ? "AT_MOST" : "AT_LEAST");
  if (body.departmentId) {
    const dept = await prisma.facilityDepartment.findFirst({ where: { id: body.departmentId, facilityId: access.facility.id }, select: { id: true } });
    if (!dept) throw badRequest("Unknown department");
  }
  const scopeKey = body.departmentId ?? "FACILITY";
  const row = await prisma.analyticsPerformanceTarget.upsert({
    where: { facilityId_metricKey_scopeKey: { facilityId: access.facility.id, metricKey: body.metricKey, scopeKey } },
    create: { facilityId: access.facility.id, metricKey: body.metricKey, scopeKey, departmentId: body.departmentId ?? null, targetValue: body.targetValue, direction, note: body.note ?? null, createdById: user.id },
    update: { targetValue: body.targetValue, direction, note: body.note ?? null },
  });
  await prisma.analyticsSnapshot.deleteMany({ where: { facilityId: access.facility.id } });
  await auditAnalytics(access, "ANALYTICS_TARGET_SET", body.metricKey, { scope: scopeKey, target: body.targetValue, direction }, req);
  return NextResponse.json({ id: row.id });
});

// DELETE — remove a target (?metricKey=…&departmentId=…).
export const DELETE = withAuth(null, async (req, { user }) => {
  const { access, scope } = await analyticsAccess(user, req);
  requireManager(scope.permissions);
  const sp = new URL(req.url).searchParams;
  const metricKey = z.string().min(1).max(80).parse(sp.get("metricKey"));
  const departmentId = sp.get("departmentId");
  const scopeKey = departmentId ? z.string().uuid().parse(departmentId) : "FACILITY";
  const res = await prisma.analyticsPerformanceTarget.deleteMany({ where: { facilityId: access.facility.id, metricKey, scopeKey } });
  await prisma.analyticsSnapshot.deleteMany({ where: { facilityId: access.facility.id } });
  await auditAnalytics(access, "ANALYTICS_TARGET_REMOVED", metricKey, { scope: scopeKey, removed: res.count }, req);
  return NextResponse.json({ removed: res.count });
});
