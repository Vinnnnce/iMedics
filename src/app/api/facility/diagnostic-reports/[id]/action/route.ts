import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import {
  assertDiagnosticReportTransition,
  diagnosticReportIsLocked,
  DIAGNOSTIC_REPORT_STATUS_LABEL,
} from "@/lib/modules/workflows";
import type { DiagnosticReportStatus } from "@prisma/client";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications/service";

const actionSchema = z.object({
  action: z.enum(["SUBMIT", "FINALIZE", "SEND", "AMEND"]),
  reason: z.string().trim().max(2000).optional(),
  // For AMEND: the corrected report content.
  preliminaryFindings: z.string().trim().max(20000).optional(),
  specialistInterpretation: z.string().trim().max(20000).optional(),
  recommendations: z.string().trim().max(10000).optional(),
});

// Concurrency-safe conditional update: the transition only applies while the
// report is still in the status that was validated, so a stale request can
// never silently overwrite a concurrent finalization or amendment.
async function transitionStatus(id: string, from: DiagnosticReportStatus, to: DiagnosticReportStatus) {
  const result = await prisma.diagnosticReport.updateMany({
    where: { id, status: from },
    data: { status: to },
  });
  if (result.count === 0) {
    throw conflict("This report just changed status — refresh and try again");
  }
}

// POST /api/facility/diagnostic-reports/[id]/action — verification, signing,
// delivery and amendments (Module 03, Category 04/05). Finalized reports are
// never overwritten: amendments snapshot the current content as a new
// immutable version with a mandatory reason.
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "ENTER_RESULTS", req);
  await requireFacilityKind(access, ["DIAGNOSTIC_CENTRE"]);
  const id = parseId((await params).id);
  const data = await parseBody(req, actionSchema);

  const report = await prisma.diagnosticReport.findFirst({
    where: { id, facilityId: access.facility.id },
    select: {
      id: true,
      status: true,
      bookingId: true,
      preliminaryFindings: true,
      specialistInterpretation: true,
      recommendations: true,
      booking: { select: { requestingFacilityId: true, patient: { select: { userId: true } } } },
    },
  });
  if (!report) throw notFound("Diagnostic report not found");
  if (data.action === "SUBMIT") {
    assertDiagnosticReportTransition(report.status, "AWAITING_VERIFICATION", access.permissions);
    if (!report.preliminaryFindings?.trim() && !report.specialistInterpretation?.trim()) {
      throw badRequest("The report needs findings or a specialist interpretation before submission");
    }
    await transitionStatus(id, report.status, "AWAITING_VERIFICATION");
    await writeAudit({
      userId: user.id, actorRole: user.role, action: "DIAGNOSTIC_REPORT_SUBMITTED",
      resourceType: "DiagnosticReport", resourceId: id, req,
    });
    return NextResponse.json({ success: true, report: { id, status: "AWAITING_VERIFICATION" } });
  }

  if (data.action === "FINALIZE") {
    assertDiagnosticReportTransition(report.status, "FINALIZED", access.permissions);
    // Finalization = professional verification + signature by the same
    // authorized professional (Module 03: "finalize and sign"). The conditional
    // update guards against a concurrent amendment or submission.
    const finalized = await prisma.diagnosticReport.updateMany({
      where: { id, status: report.status },
      data: {
        status: "FINALIZED",
        verifiedById: user.id,
        verifiedAt: new Date(),
        signedById: user.id,
        signedAt: new Date(),
        finalizedAt: new Date(),
      },
    });
    if (finalized.count === 0) {
      throw conflict("This report just changed status — refresh and try again");
    }
    // Version snapshot: the immutable original that any later amendment is
    // measured against (Module 03, Category 03).
    const last = await prisma.diagnosticReportVersion.findFirst({
      where: { reportId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await prisma.diagnosticReportVersion.create({
      data: {
        reportId: id,
        version: (last?.version ?? 0) + 1,
        snapshot: {
          preliminaryFindings: report.preliminaryFindings,
          specialistInterpretation: report.specialistInterpretation,
          recommendations: report.recommendations,
        },
        changedById: user.id,
      },
    });
    await writeAudit({
      userId: user.id, actorRole: user.role, action: "DIAGNOSTIC_REPORT_FINALIZED",
      resourceType: "DiagnosticReport", resourceId: id, req,
    });
    return NextResponse.json({ success: true, report: { id, status: "FINALIZED" } });
  }

  if (data.action === "SEND") {
    assertDiagnosticReportTransition(report.status, "SENT", access.permissions);
    const sent = await prisma.diagnosticReport.updateMany({
      where: { id, status: report.status },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sentToFacilityId: report.booking.requestingFacilityId ?? null,
      },
    });
    if (sent.count === 0) {
      throw conflict("This report just changed status — refresh and try again");
    }
    await writeAudit({
      userId: user.id, actorRole: user.role, action: "DIAGNOSTIC_REPORT_SENT",
      resourceType: "DiagnosticReport", resourceId: id,
      details: { toFacilityId: report.booking.requestingFacilityId ?? null }, req,
    });
    // Notify the requesting hospital's owner account, when known.
    if (report.booking.requestingFacilityId) {
      const owner = await prisma.labStaffProfile.findUnique({
        where: { id: report.booking.requestingFacilityId },
        select: { user: { select: { id: true } } },
      });
      if (owner?.user?.id) {
        await notifyUser(owner.user.id, { kind: "DIAGNOSTIC_REPORT_READY", bookingId: report.bookingId }).catch(() => undefined);
      }
    }
    return NextResponse.json({ success: true, report: { id, status: "SENT" } });
  }

  // AMEND — correction of a finalized/sent report.
  assertDiagnosticReportTransition(report.status, "AMENDED", access.permissions, data.reason);
  if (!diagnosticReportIsLocked(report.status)) {
    throw badRequest("Only finalized or delivered reports are amended");
  }
  await prisma.$transaction(async (tx) => {
    // Conditional transition guarded on the validated status.
    const r = await tx.diagnosticReport.updateMany({
      where: { id, status: report.status },
      data: {
        status: "AMENDED",
        ...(data.preliminaryFindings !== undefined ? { preliminaryFindings: data.preliminaryFindings } : {}),
        ...(data.specialistInterpretation !== undefined ? { specialistInterpretation: data.specialistInterpretation } : {}),
        ...(data.recommendations !== undefined ? { recommendations: data.recommendations } : {}),
      },
    });
    if (r.count === 0) throw conflict("This report just changed status — refresh and try again");
    const last = await tx.diagnosticReportVersion.findFirst({
      where: { reportId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    // The amendment version records who made the correction and re-verifies it:
    // the amending professional signs the corrected content, while the prior
    // version keeps the original author and signer (Category 03).
    await tx.diagnosticReportVersion.create({
      data: {
        reportId: id,
        version: (last?.version ?? 0) + 1,
        snapshot: {
          preliminaryFindings: data.preliminaryFindings ?? report.preliminaryFindings,
          specialistInterpretation: data.specialistInterpretation ?? report.specialistInterpretation,
          recommendations: data.recommendations ?? report.recommendations,
        },
        reason: data.reason,
        changedById: user.id,
      },
    });
    return r;
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "DIAGNOSTIC_REPORT_AMENDED",
    resourceType: "DiagnosticReport", resourceId: id,
    details: { reason: data.reason ?? null }, req,
  });

  return NextResponse.json({ success: true, report: { id, status: "AMENDED" }, message: `Amended (${DIAGNOSTIC_REPORT_STATUS_LABEL.AMENDED}) — the original version is preserved in the report history` });
});
