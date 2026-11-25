import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { analyticsAccess, auditAnalytics } from "@/lib/analytics/http";
import { assertDashboardAllowed } from "@/lib/analytics/scope";
import { EXPORT_CONTENT_TYPE, EXPORT_FORMATS, exportFilename, renderExport, reportRowCount } from "@/lib/analytics/report";
import { asDocument } from "@/lib/analytics/report-service";

const formatSchema = z.enum([...EXPORT_FORMATS, "json"]).default("json");

// GET — a generated report, as json (for the viewer / print) or as csv, xlsx, pdf.
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { access, scope } = await analyticsAccess(user, req);
  const row = await prisma.analyticsGeneratedReport.findFirst({ where: { id, facilityId: access.facility.id } });
  if (!row) throw notFound("Report not found");
  assertDashboardAllowed(scope, row.reportKey as never); // viewers need the same rights as for the live dashboard
  const doc = asDocument(row.payload);
  const format = formatSchema.parse(new URL(req.url).searchParams.get("format") ?? undefined);
  if (format === "json") return NextResponse.json({ id: row.id, createdAt: row.createdAt, trigger: row.trigger, document: doc });
  const body = await renderExport(doc, format);
  await auditAnalytics(access, "ANALYTICS_EXPORT", row.reportKey, { format, rows: reportRowCount(doc), reportId: row.id }, req);
  return new Response(body as BodyInit, { headers: { "Content-Type": EXPORT_CONTENT_TYPE[format], "Content-Disposition": `attachment; filename="${exportFilename(doc, format)}"`, "X-Content-Type-Options": "nosniff" } });
}, { rateLimit: RATE_LIMITS.download });
