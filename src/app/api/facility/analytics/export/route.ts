import { z } from "zod";
import { withAuth } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { forbidden } from "@/lib/errors";
import { analyticsAccess, auditAnalytics, describeScope, rangeFromRequest, guardPeriod } from "@/lib/analytics/http";
import { loadDashboard } from "@/lib/analytics";
import { buildReportDocument, EXPORT_CONTENT_TYPE, EXPORT_FORMATS, exportFilename, renderExport, REPORT_KEYS, reportRowCount } from "@/lib/analytics/report";

const schema = z.object({ report: z.string().refine((k) => (REPORT_KEYS as string[]).includes(k), "Unknown report"), format: z.enum(EXPORT_FORMATS) });

// GET — export a report as csv, xlsx or pdf. Same authorisation as viewing the dashboard it comes from.
export const GET = withAuth(null, async (req, { user }) => {
  const { access, scope } = await analyticsAccess(user, req);
  const q = schema.parse(Object.fromEntries(new URL(req.url).searchParams));
  if (scope.departmentIds !== null) throw forbidden("Department-limited access cannot export reports");
  const payload = await guardPeriod(() => loadDashboard(scope, q.report as never, rangeFromRequest(req), { skipCache: true }));
  const doc = buildReportDocument(payload, describeScope(scope));
  const body = await renderExport(doc, q.format);
  await auditAnalytics(access, "ANALYTICS_EXPORT", q.report, { format: q.format, rows: reportRowCount(doc), period: `${doc.period.startDate}/${doc.period.endDate}` }, req);
  return new Response(body as BodyInit, { headers: { "Content-Type": EXPORT_CONTENT_TYPE[q.format], "Content-Disposition": `attachment; filename="${exportFilename(doc, q.format)}"`, "X-Content-Type-Options": "nosniff" } });
}, { rateLimit: RATE_LIMITS.download });
