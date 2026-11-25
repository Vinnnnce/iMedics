import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadDashboard } from "./index";
import { buildReportDocument, reportRowCount, type ReportDocument } from "./report";
import type { AnalyticsScope } from "./scope";
import type { RangeInput } from "./periods";
import type { DashboardKey } from "./types";

export async function generateReport(input: {
  scope: AnalyticsScope; reportKey: DashboardKey; range: RangeInput; scopeNote: string; trigger: "MANUAL" | "SCHEDULED"; definitionId?: string | null; generatedById: string | null; now?: Date;
}) {
  const payload = await loadDashboard(input.scope, input.reportKey, input.range, { now: input.now, skipCache: true });
  const doc = buildReportDocument(payload, input.scopeNote);
  const row = await prisma.analyticsGeneratedReport.create({
    data: {
      facilityId: input.scope.facility.id, definitionId: input.definitionId ?? null, reportKey: input.reportKey, title: doc.title,
      periodStart: new Date(payload.range.current.start), periodEnd: new Date(payload.range.current.end), timeZone: payload.range.timeZone,
      rowCount: reportRowCount(doc), payload: doc as unknown as Prisma.InputJsonValue, generatedById: input.generatedById, trigger: input.trigger,
    },
  });
  return { id: row.id, doc };
}

export const asDocument = (payload: unknown): ReportDocument => payload as ReportDocument;
