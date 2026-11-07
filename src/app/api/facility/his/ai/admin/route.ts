import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireHisAccess } from "@/lib/his/access";
import { enforceAiRateLimit } from "@/lib/ai/rate-limit";
import { completeJson, AiUnavailableError } from "@/lib/ai/llm";
import { logAiUsage } from "@/lib/ai/audit";

const outputSchema = z.object({
  summary: z.string().min(1),
  highlights: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});

/**
 * POST /api/facility/his/ai/admin — AI hospital administration summary.
 * Compiles live operational metrics (encounters, admissions, beds, lab
 * workload, pharmacy activity) into a draft operational summary. Numbers are
 * computed from the database — the AI only narrates them.
 */
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "VIEW_ANALYTICS", req, ["HOSPITAL"]);
  await parseBody(req, z.object({}));

  const now = new Date();
  const last24h = new Date(now.getTime() - 86_400_000);

  const [encounters, activeAdmissions, beds, labOrders, dispensed, criticalAlerts, appointments] = await Promise.all([
    prisma.encounter.count({ where: { facilityId: access.facility.id, createdAt: { gte: last24h } } }),
    prisma.admission.count({ where: { facilityId: access.facility.id, status: "ACTIVE" } }),
    prisma.bed.groupBy({ by: ["status"], where: { facilityId: access.facility.id }, _count: { _all: true } }),
    prisma.labOrder.count({ where: { performingFacilityId: access.facility.id, createdAt: { gte: last24h } } }),
    prisma.medicationOrder.count({ where: { facilityId: access.facility.id, dispensedAt: { gte: last24h } } }),
    prisma.criticalResultAlert.count({ where: { orderingFacilityId: access.facility.id, acknowledgedAt: null } }),
    prisma.facilityBooking.count({ where: { service: { facilityId: access.facility.id }, createdAt: { gte: last24h } } }),
  ]);
  const bedCounts = Object.fromEntries(beds.map((b) => [b.status, b._count._all]));

  await enforceAiRateLimit(user.id);

  const context = {
    encountersLast24h: encounters,
    activeAdmissions,
    beds: bedCounts,
    labOrdersLast24h: labOrders,
    medicationDispensedLast24h: dispensed,
    unacknowledgedCriticalAlerts: criticalAlerts,
    newAppointmentsLast24h: appointments,
  };

  let output: z.infer<typeof outputSchema>;
  let generated = true;
  try {
    output = await completeJson({
      schema: outputSchema,
      maxTokens: 1000,
      system: `You are a hospital operations assistant. Narrate the supplied live metrics into a concise operational summary draft.
Only use the numbers provided — never estimate or invent figures. Flag capacity risks factually (e.g. bed availability).
Do not make clinical statements. Return JSON {summary, highlights, recommendations}. Output is a draft for the administrator.`,
      user: JSON.stringify(context),
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      generated = false;
      const available = bedCounts.AVAILABLE ?? 0;
      const occupied = bedCounts.OCCUPIED ?? 0;
      output = {
        summary: `Operational snapshot (auto-compiled): ${encounters} encounters and ${labOrders} lab orders in the last 24h; ${activeAdmissions} active admissions; ${occupied} beds occupied, ${available} available; ${criticalAlerts} unacknowledged critical alerts.`,
        highlights: [`${dispensed} medications dispensed in the last 24h`, `${appointments} new appointments`],
        recommendations: criticalAlerts > 0 ? [`Review ${criticalAlerts} unacknowledged critical result alert(s)`] : [],
      };
    } else {
      throw error;
    }
  }

  await logAiUsage({
    userId: user.id,
    feature: "ADMIN_SUMMARY",
    status: "COMPLETED",
    facilityId: access.facility.id,
    inputRefs: ["metrics:live"],
    metadata: { generatedByProvider: generated },
  });

  return NextResponse.json({
    draft: output,
    aiGenerated: generated,
    metrics: context,
    disclaimer: "AI-generated draft from live facility metrics. Review before circulating.",
  });
});
