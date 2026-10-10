import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { conflict, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]) });

// POST /api/ai-analyses/[id]/review — the doctor's approve / reject decision on an AI analysis.
// Approval is the ONLY way AI text becomes visible to a patient.
export const POST = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { decision } = await parseBody(req, schema);

  const analysis = await prisma.aiAnalysis.findUnique({
    where: { id },
    include: {
      labResult: { select: { patientId: true } },
      medicalHistory: { select: { patientId: true } },
      consultation: { select: { patientId: true } },
    },
  });
  if (!analysis) throw notFound("AI analysis not found");

  const patientId = (analysis.labResult ?? analysis.medicalHistory ?? analysis.consultation)?.patientId;
  if (!patientId) throw notFound("AI analysis not found");

  // Only a doctor currently caring for the patient may decide (404 otherwise).
  const patient = await findAccessiblePatient(user, patientId, { write: true });

  if (analysis.reviewStatus !== "PENDING_REVIEW") throw conflict("This analysis has already been reviewed");
  if (analysis.status !== "COMPLETED" && analysis.status !== "COMPLETED_WITH_OVERRIDE") {
    throw conflict("Only completed analyses can be reviewed");
  }
  if (decision === "APPROVED" && !analysis.patientView) {
    throw conflict("This analysis has no patient-facing summary to approve");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.aiAnalysis.update({
      where: { id },
      data: { reviewStatus: decision, reviewedById: user.id, reviewedAt: new Date() },
    });

    if (decision === "APPROVED" && patient.userId) {
      await tx.notification.create({
        data: {
          userId: patient.userId,
          type: analysis.labResult ? "LAB_RESULT" : "SYSTEM",
          title: "A new summary is available",
          data: { analysisId: id },
        },
      });
    }
    return result;
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: `AI_ANALYSIS_${decision}`,
    resourceType: "AiAnalysis",
    resourceId: id,
    req,
  });

  return NextResponse.json({ success: true, analysis: { id: updated.id, reviewStatus: updated.reviewStatus, reviewedAt: updated.reviewedAt } });
});
