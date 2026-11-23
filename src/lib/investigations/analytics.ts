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
  const base = { performing_facility_id: facilityId, investigation_orders: { status: { not: "DRAFT" as const } } };
  const [open, overdue, released, rejected, alerts, byDept] = await Promise.all([
    prisma.investigation_order_items.count({ where: { ...base, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED"] } } }),
    prisma.investigation_order_items.count({ where: { ...base, due_at: { lt: now }, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED"] } } }),
    prisma.investigation_order_items.findMany({ where: { ...base, status: { in: ["RELEASED", "DELIVERED"] }, status_changed_at: { gte: since } }, select: { id: true, created_at: true, due_at: true }, take: 2000 }),
    prisma.investigation_specimens.count({ where: { facility_id: facilityId, status: { in: ["REJECTED", "RECOLLECTION_REQUESTED"] }, created_at: { gte: since } } }),
    prisma.investigation_critical_alerts.count({ where: { facility_id: facilityId, status: { in: ["SENT", "ESCALATED"] } } }),
    prisma.investigation_order_items.groupBy({ by: ["domain", "department_key"], where: { ...base, status: { notIn: ["RELEASED", "DELIVERED", "CANCELLED"] } }, _count: { _all: true } }),
  ]);
  // First released version of each item (the item's result history is read separately: see results.ts).
  const releases = released.length
    ? await prisma.investigation_results.findMany({ where: { item_id: { in: released.map((r) => r.id) }, status: "RELEASED" }, orderBy: { version: "asc" }, select: { item_id: true, released_at: true } })
    : [];
  const firstRelease = new Map<string, Date | null>();
  for (const r of releases) if (!firstRelease.has(r.item_id)) firstRelease.set(r.item_id, r.released_at);
  const timed = released
    .map((r) => {
      const at = firstRelease.get(r.id) ?? null;
      return { ms: (at?.getTime() ?? 0) - r.created_at.getTime(), due: r.due_at, at };
    })
    .filter((r) => r.at && r.ms > 0);
  return {
    open, overdue, releasedLast30Days: released.length,
    avgTurnaroundHours: timed.length ? Math.round((timed.reduce((s, r) => s + r.ms, 0) / timed.length / 3_600_000) * 10) / 10 : null,
    onTimePercent: timed.length ? Math.round((timed.filter((r) => !r.due || (r.at as Date) <= r.due).length / timed.length) * 100) : null,
    rejectedSpecimens30Days: rejected, openCriticalAlerts: alerts,
    byDepartment: byDept.map((d) => ({ domain: d.domain, department: d.department_key, open: d._count._all })),
  };
}
