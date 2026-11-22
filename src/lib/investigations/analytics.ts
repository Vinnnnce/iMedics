import { prisma } from "@/lib/prisma";

export interface FacilityAnalytics {
  open: number;
  overdue: number;
  releasedLast30Days: number;
  avgTurnaroundHours: number | null;
  onTimePercent: number | null;
  rejectedSpecimens30Days: number;
  openCriticalAlerts: number;
  byDepartment: { domain: string; department: string; open: number }[];
}

/** Operational analytics for one facility: volume, turnaround (request to release), overdue and rejections. */
export async function facilityAnalytics(facilityId: string, now = new Date()): Promise<FacilityAnalytics> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const base = { performingFacilityId: facilityId, order: { status: { not: "DRAFT" as const } } };
  const [open, overdue, released, rejected, alerts, byDept] = await Promise.all([
    prisma.investigation_order_items.count({ where: { ...base, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED"] } } }),
    prisma.investigation_order_items.count({ where: { ...base, dueAt: { lt: now }, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED"] } } }),
    prisma.investigation_order_items.findMany({ where: { ...base, status: { in: ["RELEASED", "DELIVERED"] }, statusChangedAt: { gte: since } }, select: { createdAt: true, dueAt: true, results: { where: { status: "RELEASED" }, orderBy: { version: "asc" }, take: 1, select: { releasedAt: true } } }, take: 2000 }),
    prisma.investigation_specimens.count({ where: { facilityId, status: { in: ["REJECTED", "RECOLLECTION_REQUESTED"] }, createdAt: { gte: since } } }),
    prisma.investigation_critical_alerts.count({ where: { facilityId, status: { in: ["SENT", "ESCALATED"] } } }),
    prisma.investigation_order_items.groupBy({ by: ["domain", "departmentKey"], where: { ...base, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED"] } }, _count: { _all: true } }),
  ]);
  const timed = released.map((r) => ({ ms: (r.results[0]?.releasedAt?.getTime() ?? 0) - r.createdAt.getTime(), due: r.dueAt, at: r.results[0]?.releasedAt })).filter((r) => r.at && r.ms > 0);
  return {
    open, overdue, releasedLast30Days: released.length,
    avgTurnaroundHours: timed.length ? Math.round((timed.reduce((s, r) => s + r.ms, 0) / timed.length / 3_600_000) * 10) / 10 : null,
    onTimePercent: timed.length ? Math.round((timed.filter((r) => !r.due || (r.at as Date) <= r.due).length / timed.length) * 100) : null,
    rejectedSpecimens30Days: rejected, openCriticalAlerts: alerts,
    byDepartment: byDept.map((d) => ({ domain: d.domain, department: d.departmentKey, open: d._count._all })),
  };
}
