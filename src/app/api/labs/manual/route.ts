import { NextResponse } from "next/server";
import { z } from "zod";
import type { LabCategory, ResultFlag } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { findAccessiblePatient, getVerifiedLabProfile } from "@/lib/access";
import { aiAnalysisForViewer } from "@/lib/ai-view";
import { badRequest, notFound } from "@/lib/errors";
import { ApiError } from "@/lib/errors";
import { runLabAnalysis } from "@/lib/ai/lab-analysis";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications/service";

const LAB_CATEGORIES: readonly LabCategory[] = ["BLOOD", "URINE", "STOOL", "SWAB", "XRAY", "CT", "ULTRASOUND", "MRI", "OTHER"];

function toLabCategory(category: string): LabCategory {
  const key = category.trim().toUpperCase().replace(/[\s-]+/g, "_") as LabCategory;
  return LAB_CATEGORIES.includes(key) ? key : "OTHER";
}

function toNumber(value: string): number | null {
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

function computeFlag(
  value: number | null,
  low: number | null,
  high: number | null,
  critLow: number | null,
  critHigh: number | null,
): ResultFlag | null {
  if (value === null) return null;
  // Critical bounds, when supplied by the laboratory, take precedence and are
  // evaluated even without routine reference intervals.
  if (critLow !== null && value < critLow) return "CRITICAL_LOW";
  if (critHigh !== null && value > critHigh) return "CRITICAL_HIGH";
  if (low === null || high === null) return null;
  if (value < low) return "LOW";
  if (value > high) return "HIGH";
  return "NORMAL";
}

const submitSchema = z.object({
  patientId: z.string().uuid(),
  labOrderId: z.string().uuid().optional(),
  category: z.string().trim().min(1).max(100),
  labName: z.string().trim().max(200).optional(),
  // Reason is required when correcting an already-verified result.
  reason: z.string().trim().max(1000).optional(),
  testDate: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid test date"),
  patientLanguage: z.string().trim().max(20).optional(),
  values: z
    .array(
      z.object({
        code: z.string().trim().min(1).max(50),
        name: z.string().trim().min(1).max(200),
        value: z.string().trim().min(1).max(100),
        unit: z.string().trim().max(50).default(""),
        refLow: z.string().trim().max(50).default(""),
        refHigh: z.string().trim().max(50).default(""),
        // Optional critical alert bounds — when supplied and exceeded, the
        // value is flagged CRITICAL_LOW / CRITICAL_HIGH and a critical-result
        // alert is raised for the ordering clinician (Module 02, Category 04).
        critLow: z.string().trim().max(50).optional(),
        critHigh: z.string().trim().max(50).optional(),
      }),
    )
    .min(1)
    .max(200),
});

// POST /api/labs/manual — verified lab staff enter results for a patient.
// AI analysis runs server-side and is stored for doctor review; its text is not returned to lab staff.
export const POST = withAuth(["LAB_SCIENTIST"], async (req, { user }) => {
  await getVerifiedLabProfile(user);
  const data = await parseBody(req, submitSchema);

  const patient = await prisma.patient.findFirst({
    where: { id: data.patientId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) throw notFound("Patient not found");

  if (data.labOrderId) {
    const order = await prisma.labOrder.findFirst({ where: { id: data.labOrderId, patientId: patient.id } });
    if (!order) throw badRequest("This lab order does not belong to the selected patient");
  }

  const rows = data.values.map((v) => {
    const numericValue = toNumber(v.value);
    const refLow = toNumber(v.refLow);
    const refHigh = toNumber(v.refHigh);
    const critLow = v.critLow ? toNumber(v.critLow) : null;
    const critHigh = v.critHigh ? toNumber(v.critHigh) : null;
    return {
      code: v.code,
      name: v.name,
      value: v.value,
      numericValue,
      unit: v.unit || null,
      refLow,
      refHigh,
      flag: computeFlag(numericValue, refLow, refHigh, critLow, critHigh),
    };
  });

  const hasCriticalFinding = rows.some((r) => r.flag === "CRITICAL_LOW" || r.flag === "CRITICAL_HIGH");

  const labResult = await prisma.$transaction(async (tx) => {
    // If this order already carries a verified result, submitting a corrected
    // result must leave a traceable amendment rather than silently replacing
    // the verified record (Module 02, Category 03). A non-blank correction
    // reason is mandatory, and the corrected order returns to verification —
    // an unverified correction is never releasable as final.
    let priorVerifiedResultId: string | null = null;
    if (data.labOrderId) {
      const prior = await tx.labResult.findFirst({
        where: { labOrderId: data.labOrderId, verifiedAt: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { id: true, values: { select: { name: true, value: true, unit: true, flag: true } } },
      });
      if (prior) {
        if (!data.reason?.trim()) {
          throw badRequest("A corrected result requires a reason for the amendment");
        }
        priorVerifiedResultId = prior.id;
        await tx.labResultAmendment.create({
          data: {
            labResultId: prior.id,
            changedById: user.id,
            reason: data.reason,
            previousSnapshot: { values: prior.values },
          },
        });
      }
    }
    const created = await tx.labResult.create({
      data: {
        patientId: patient.id,
        labOrderId: data.labOrderId,
        panelType: data.category,
        category: toLabCategory(data.category),
        testDate: new Date(data.testDate),
        labName: data.labName || null,
        status: "PENDING_AI_ANALYSIS",
        uploadedById: user.id,
        values: { create: rows },
      },
    });
    if (data.labOrderId) {
      // A corrected submission on a verified order returns the order to
      // verification (never straight to a releasable state); fresh orders
      // complete normally.
      await tx.labOrder.update({
        where: { id: data.labOrderId },
        data: { status: priorVerifiedResultId ? "AWAITING_VERIFICATION" : "COMPLETED" },
      });
    }
    return created;
  });

  // AI runs after the result is safely stored. If it is rate-limited or fails, the result stays
  // pending and a doctor can trigger the analysis later.
  let analysed = false;
  try {
    const { outcome } = await runLabAnalysis(labResult.id, user, data.patientLanguage);
    analysed = outcome === "completed";
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 429)) console.error("Lab AI analysis failed:", error);
  }

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "LAB_RESULT_SUBMITTED",
    resourceType: "LabResult",
    resourceId: labResult.id,
    details: { values: rows.length },
    req,
  });

  // Critical-result workflow (Module 02, Category 04): a critical finding
  // raises an alert for the ordering clinician/hospital that must be
  // acknowledged; the notification itself carries no clinical detail.
  let criticalAlertId: string | null = null;
  if (hasCriticalFinding) {
    const order = data.labOrderId
      ? await prisma.labOrder.findUnique({
          where: { id: data.labOrderId },
          select: { id: true, requestingFacilityId: true, orderedById: true },
        })
      : null;
    if (order) {
      const alert = await prisma.criticalResultAlert.create({
        data: {
          labResultId: labResult.id,
          labOrderId: order.id,
          patientId: patient.id,
          orderingFacilityId: order.requestingFacilityId,
          status: "SENT",
        },
        select: { id: true },
      });
      criticalAlertId = alert.id;
      const recipientUserId = order.requestingFacilityId
        ? (
            await prisma.labStaffProfile
              .findUnique({
                where: { id: order.requestingFacilityId },
                select: { user: { select: { id: true } } },
              })
              .then((f) => f?.user?.id)
              .catch(() => undefined)
          )
        : order.orderedById;
      if (recipientUserId) {
        await notifyUser(recipientUserId, {
          kind: "CRITICAL_RESULT_ALERTED",
          alertId: alert.id,
          orderId: order.id,
        }).catch(() => undefined);
      }
    }
  }

  const flagged = rows.filter((r) => r.flag === "LOW" || r.flag === "HIGH");
  return NextResponse.json(
    {
      message: "Lab results submitted successfully",
      labResultId: labResult.id,
      category: data.category,
      labName: data.labName ?? null,
      testDate: data.testDate,
      totalValues: rows.length,
      flaggedCount: flagged.length,
      flagged: flagged.map((r) => ({ code: r.code, name: r.name, value: r.value, flag: r.flag })),
      criticalAlertId,
      status: analysed ? "ai_analysis_complete" : "pending_ai_analysis",
    },
    { status: 201 },
  );
});

const listQuerySchema = z.object({ patientId: z.string().uuid() });

// GET /api/labs/manual?patientId= — results for a patient the caller may access.
// Patients never see AI text until a doctor has approved it, and never see rejected results.
export const GET = withAuth(["DOCTOR", "PATIENT"], async (req, { user }) => {
  const { patientId } = parseQuery(req, listQuerySchema);
  await findAccessiblePatient(user, patientId);

  const results = await prisma.labResult.findMany({ take: 200,
    where: { patientId, ...(user.role === "PATIENT" ? { status: { not: "REJECTED" as const } } : {}) },
    orderBy: { testDate: "desc" },
    include: {
      values: true,
      files: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
      aiAnalysis: true,
    },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "LAB_RESULTS_VIEWED",
    resourceType: "Patient",
    resourceId: patientId,
    req,
  });

  return NextResponse.json({
    results: results.map(({ aiAnalysis, ...result }) => ({
      ...result,
      aiAnalysis: aiAnalysisForViewer(aiAnalysis, user.role),
    })),
  });
});
