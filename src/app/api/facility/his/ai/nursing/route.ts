import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { enforceAiRateLimit } from "@/lib/ai/rate-limit";
import { completeJson, AiUnavailableError } from "@/lib/ai/llm";
import { logAiUsage } from "@/lib/ai/audit";
import { ApiError } from "@/lib/errors";

const schema = z.object({
  patientId: z.string().uuid(),
  admissionId: z.string().uuid().optional(),
});

const outputSchema = z.object({
  summary: z.string().min(1),
  outstandingTasks: z.array(z.string()).default([]),
  escalationNotes: z.array(z.string()).default([]),
});

/**
 * POST /api/facility/his/ai/nursing — AI nursing handover summary.
 * Compiles the patient's live nursing data (observations, tasks, handovers)
 * into a draft handover. The output is a DRAFT for the responsible nurse to
 * review, edit and accept; the AI never signs or releases anything.
 */
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "RECORD_NURSING", req, ["HOSPITAL"]);
  const body = await parseBody(req, schema);

  const [observations, tasks, lastHandover] = await Promise.all([
    prisma.nursingObservation.findMany({
      where: { facilityId: access.facility.id, patientId: body.patientId },
      orderBy: { recordedAt: "desc" },
      take: 20,
      select: { observationType: true, value: true, unit: true, recordedAt: true },
    }),
    prisma.nursingTask.findMany({
      where: { facilityId: access.facility.id, patientId: body.patientId, status: { notIn: ["DONE", "CANCELLED"] } },
      orderBy: { dueAt: "asc" },
      take: 20,
      select: { title: true, dueAt: true },
    }),
    prisma.nursingHandover.findFirst({
      where: { facilityId: access.facility.id, patientId: body.patientId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, summary: true },
    }),
  ]);

  await enforceAiRateLimit(user.id);

  // Structured, de-identified context (no names, only clinical data).
  const context = {
    observations: observations.map((o) => ({
      type: o.observationType, value: o.value, unit: o.unit,
      at: o.recordedAt.toISOString().slice(0, 16),
    })),
    openTasks: tasks.map((t) => ({ title: t.title, due: t.dueAt?.toISOString().slice(0, 16) ?? null })),
    previousHandover: lastHandover?.summary?.slice(0, 1000) ?? null,
  };

  let output: z.infer<typeof outputSchema>;
  let generated = true;
  try {
    output = await completeJson({
      schema: outputSchema,
      maxTokens: 1200,
      system: `You are a nursing documentation assistant. Compile a structured shift handover draft.
Use only the supplied observations and tasks. Do not invent findings, diagnoses or medications.
Highlight overdue tasks and abnormal observations factually (value + unit), without clinical conclusions.
Return JSON {summary, outstandingTasks, escalationNotes}. All output is an unsaved AI draft requiring nurse review.`,
      user: JSON.stringify(context),
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      generated = false;
      // Deterministic fallback: the facts without any AI wording.
      output = {
        summary: `Nursing data summary (auto-compiled): ${observations.length} recent observations, ${tasks.length} open tasks.`,
        outstandingTasks: tasks.map((t) => `${t.title}${t.dueAt ? ` (due ${t.dueAt.toISOString().slice(0, 16)})` : ""}`),
        escalationNotes: [],
      };
    } else {
      throw error;
    }
  }

  await logAiUsage({
    userId: user.id,
    feature: "NURSING_HANDOVER",
    status: "COMPLETED",
    facilityId: access.facility.id,
    patientId: body.patientId,
    inputRefs: [`observations:${observations.length}`, `tasks:${tasks.length}`],
    metadata: { generatedByProvider: generated },
  });

  return NextResponse.json({
    draft: output,
    aiGenerated: generated,
    disclaimer: "AI-generated draft. Review, edit and accept as the responsible nurse before it becomes part of the record.",
  });
});
