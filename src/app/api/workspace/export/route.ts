import { withAuth, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { extensionAudit } from "@/lib/workspace/extensions";
import { csvCell } from "@/lib/workspace/intelligence";
import { analyticsRange, analyticsRangeSchema } from "@/lib/workspace/analytics";
import { badRequest } from "@/lib/errors";
export const GET = withAuth(["ADMIN"], async (req, { user }) => {
  let range;
  try { range = analyticsRange(parseQuery(req, analyticsRangeSchema)); } catch { throw badRequest("Choose an ordered date range of up to 366 days"); }
  await extensionAudit(user, "WORKSPACE_AUDIT_EXPORTED");
  // Deliberately omit clinical payloads, IPs, request headers and log details.
  const rows = await prisma.auditLog.findMany({ where: { createdAt: { gte: range.start, lt: range.end } }, orderBy: { createdAt: "desc" }, take: 10000,
    select: { id: true, actorRole: true, action: true, resourceType: true, createdAt: true } });
  const csv = [["id", "actor_role", "action", "resource_type", "created_at"].map(csvCell).join(","),
    ...rows.map(r => [r.id, r.actorRole, r.action, r.resourceType, r.createdAt.toISOString()].map(csvCell).join(","))].join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="imedics-audit.csv"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
});
