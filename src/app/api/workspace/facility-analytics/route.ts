import { withAuth, parseQuery } from "@/lib/api";
import { getVerifiedFacilityProfile } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { extensionAudit } from "@/lib/workspace/extensions";
import { analyticsRange, analyticsRangeSchema, percentile } from "@/lib/workspace/analytics";
import { badRequest } from "@/lib/errors";
export const GET = withAuth(["LAB_SCIENTIST"], async (req, { user }) => {
  const facility = await getVerifiedFacilityProfile(user);
  let range;
  try { range = analyticsRange(parseQuery(req, analyticsRangeSchema)); } catch { throw badRequest("Choose an ordered date range of up to 366 days"); }
  await extensionAudit(user, "FACILITY_ANALYTICS_READ", facility.id);
  const [resources, assignments, results, revenue] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string; kind: string; capacity: number; active: boolean; assignments: number; booked_hours: number }[]>`
      SELECT r.id, r.name, r.kind, r.capacity, r.active, count(b.id)::int AS assignments,
      COALESCE(sum(EXTRACT(EPOCH FROM (LEAST(b.ends_at, ${range.end}) - GREATEST(b.starts_at, ${range.start}))) / 3600), 0)::float AS booked_hours
      FROM workspace_resources r LEFT JOIN workspace_resource_bookings b ON b.resource_id = r.id
      AND b.starts_at < ${range.end} AND b.ends_at > ${range.start}
      AND EXISTS(SELECT 1 FROM facility_bookings fb WHERE fb.id = b.booking_id AND fb.status <> 'CANCELLED')
      WHERE r.owner_id = ${user.id}::uuid GROUP BY r.id ORDER BY r.name`,
    prisma.$queryRaw`SELECT b.id, b.booking_id, r.name, r.kind, b.starts_at, b.ends_at FROM workspace_resource_bookings b
      JOIN workspace_resources r ON r.id = b.resource_id WHERE r.owner_id = ${user.id}::uuid
      AND b.starts_at < ${range.end} AND b.ends_at > ${range.start} ORDER BY b.starts_at DESC LIMIT 100`,
    prisma.labResult.findMany({ where: { uploadedById: user.id, verifiedAt: { gte: range.start, lt: range.end } }, select: { createdAt: true, verifiedAt: true }, take: 1000 }),
    prisma.payment.groupBy({ by: ["currency", "status"], where: { payeeId: user.id, createdAt: { gte: range.start, lt: range.end }, status: { in: ["SUCCESSFUL", "REFUND_PENDING", "REFUNDED"] } }, _sum: { amount: true }, _count: { id: true } }),
  ]);
  const hours = results.filter(result => result.verifiedAt).map(result => Math.max(0, (result.verifiedAt!.getTime() - result.createdAt.getTime()) / 3600000));
  return Response.json({ from: range.start.toISOString(), toExclusive: range.end.toISOString(), resources: resources.map(resource => ({
    ...resource, calendarUtilizationPercent: resource.capacity ? Math.round(resource.booked_hours / (range.calendarHours * resource.capacity) * 1000) / 10 : null,
  })), assignments, revenue: revenue.map(row => ({ currency: row.currency, status: row.status, amount: Number(row._sum.amount ?? 0), count: row._count.id })),
    turnaround: { sample: hours.length, medianHours: percentile(hours, .5), p90Hours: percentile(hours, .9), basis: "Upload to verification; caller's uploads; at most 1,000 records verified in this range." },
    utilizationBasis: "Booked resource-hours / (capacity × all UTC calendar hours in range). This is not an opening-hours or clinical-productivity measure." });
});
