import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId, parseQuery } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { aiAnalysisForViewer } from "@/lib/ai-view";
import { serializeHistory, toHistoryData } from "@/lib/medical-history";
import { medicalHistorySchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";

type Params = { id: string };

// POST /api/patients/[id]/history — create a medical history
export const POST = withAuth<Params>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const patientId = parseId((await params).id);
  await findAccessiblePatient(user, patientId, { write: true });
  const data = await parseBody(req, medicalHistorySchema);

  const history = await prisma.medicalHistory.create({
    data: { patientId, ...toHistoryData(data) },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "HISTORY_CREATED",
    resourceType: "MedicalHistory",
    resourceId: history.id,
    req,
  });

  return NextResponse.json(serializeHistory(history), { status: 201 });
});

const listQuerySchema = z.object({ status: z.enum(["draft", "complete"]).optional() });

// GET /api/patients/[id]/history — list medical histories
export const GET = withAuth<Params>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const patientId = parseId((await params).id);
  await findAccessiblePatient(user, patientId);
  const { status } = parseQuery(req, listQuerySchema);

  const histories = await prisma.medicalHistory.findMany({
    where: { patientId, ...(status ? { status: status === "complete" ? "COMPLETE" : "DRAFT" } : {}) },
    orderBy: { createdAt: "desc" },
    include: { aiAnalysis: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "HISTORY_LISTED",
    resourceType: "Patient",
    resourceId: patientId,
    req,
  });

  return NextResponse.json({
    histories: histories.map(({ aiAnalysis, ...history }) => ({
      ...serializeHistory(history),
      aiAnalysis: aiAnalysisForViewer(aiAnalysis, user.role),
    })),
  });
});
