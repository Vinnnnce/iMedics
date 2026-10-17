import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { runLabAnalysis } from "@/lib/ai/lab-analysis";
import { AI_DISCLAIMER } from "@/lib/ai/safety";

const schema = z.object({
  labResultId: z.string().uuid(),
  patientLanguage: z.string().trim().max(20).optional(),
});

// POST /api/ai/lab — doctor-only AI analysis of a stored lab result.
// Values come from the database, not the request. The output is stored as PENDING_REVIEW and stays
// hidden from the patient until a doctor approves it (POST /api/ai-analyses/[id]/review).
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const { labResultId, patientLanguage } = await parseBody(req, schema);

  const result = await prisma.labResult.findUnique({ where: { id: labResultId }, select: { patientId: true } });
  if (!result) throw notFound("Lab result not found");
  await findAccessiblePatient(user, result.patientId);

  const { outcome, saved, message } = await runLabAnalysis(labResultId, user, patientLanguage);

  return NextResponse.json({
    analysisId: saved.id,
    outcome,
    ...(message ? { message } : {}),
    reviewStatus: saved.reviewStatus,
    urgencyLevel: saved.urgencyLevel,
    flags: saved.flags,
    doctorView: saved.doctorView,
    patientViewDraft: saved.patientView,
    safety: saved.safetyReport,
    disclaimer: AI_DISCLAIMER,
  });
});
