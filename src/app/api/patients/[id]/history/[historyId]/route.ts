import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { aiAnalysisForViewer } from "@/lib/ai-view";
import { conflict, notFound } from "@/lib/errors";
import { serializeHistory, toHistoryData } from "@/lib/medical-history";
import { medicalHistorySchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";

type Params = { id: string; historyId: string };

async function resolve(params: Promise<Params>) {
  const { id, historyId } = await params;
  return { patientId: parseId(id), historyId: parseId(historyId) };
}

// GET /api/patients/[id]/history/[historyId]
export const GET = withAuth<Params>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const { patientId, historyId } = await resolve(params);
  await findAccessiblePatient(user, patientId);

  const history = await prisma.medicalHistory.findFirst({
    where: { id: historyId, patientId },
    include: { aiAnalysis: true },
  });
  if (!history) throw notFound("Medical history not found");

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "HISTORY_VIEWED",
    resourceType: "MedicalHistory",
    resourceId: historyId,
    req,
  });

  const { aiAnalysis, ...rest } = history;
  return NextResponse.json({
    ...serializeHistory(rest),
    aiAnalysis: aiAnalysisForViewer(aiAnalysis, user.role),
  });
});

// PUT /api/patients/[id]/history/[historyId]
export const PUT = withAuth<Params>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const { patientId, historyId } = await resolve(params);
  await findAccessiblePatient(user, patientId, { write: true });
  const data = await parseBody(req, medicalHistorySchema);

  const existing = await prisma.medicalHistory.findFirst({ where: { id: historyId, patientId } });
  if (!existing) throw notFound("Medical history not found");

  const history = await prisma.medicalHistory.update({
    where: { id: historyId },
    data: toHistoryData(data),
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "HISTORY_UPDATED",
    resourceType: "MedicalHistory",
    resourceId: historyId,
    req,
  });

  return NextResponse.json(serializeHistory(history));
});

// DELETE /api/patients/[id]/history/[historyId] — drafts only; completed records are part of the medical record.
export const DELETE = withAuth<Params>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const { patientId, historyId } = await resolve(params);
  await findAccessiblePatient(user, patientId, { write: true });

  const existing = await prisma.medicalHistory.findFirst({ where: { id: historyId, patientId } });
  if (!existing) throw notFound("Medical history not found");
  if (existing.status === "COMPLETE") throw conflict("Completed medical histories cannot be deleted");

  await prisma.medicalHistory.delete({ where: { id: historyId } });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "HISTORY_DELETED",
    resourceType: "MedicalHistory",
    resourceId: historyId,
    req,
  });

  return NextResponse.json({ success: true });
});
