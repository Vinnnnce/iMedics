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
import { badRequest, notFound } from "@/lib/errors";
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
    const updated = await prisma.diagnosticReport.update({
      where: { id },
      data: { status: "AWAITING_VERIFICATION" },
      select: { id: true, status: true },
    });
    await writeAudit({
      userId: user.id, actorRole: user.role, action: "DIAGNOSTIC_REPORT_SUBMITTED",
      resourceType: "DiagnosticReport", resourceId: id, req,
    });
    return NextResponse.json({ success: true, report: updated });
  }

  if (data.action === "FINALIZE") {
    assertDiagnosticReportTransition(report.status, "FINALIZED", access.permissions);
    // Finalization = professional verification + signature by the same
    // authorized professional (Module 03: "finalize and sign").
    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.diagnosticReport.update({
        where: { id },
        data: {
          status: "FINALIZED",
          verifiedById: user.id,
          verifiedAt: new Date(),
          signedById: user.id,
          signedAt: new Date(),
          finalizedAt: new Date(),
        },
        select: { id: true, status: true },
      });
      // Version 1: the immutable snapshot of the finalized original.
      const last = await tx.diagnosticReportVersion.findFirst({
        where: { reportId: id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await tx.diagnosticReportVersion.create({
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
      return r;
    });
    await writeAudit({
      userId: user.id, actorRole: user.role, action: "DIAGNOSTIC_REPORT_FINALIZED",
      resourceType: "DiagnosticReport", resourceId: id, req,
    });
    return NextResponse.json({ success: true, report: updated });
  }

  if (data.action === "SEND") {
    assertDiagnosticReportTransition(report.status, "SENT", access.permissions);
    const updated = await prisma.diagnosticReport.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sentToFacilityId: report.booking.requestingFacilityId ?? null,
      },
      select: { id: true, status: true },
    });
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
    return NextResponse.json({ success: true, report: updated });
  }

  // AMEND — correction of a finalized/sent report.
  assertDiagnosticReportTransition(report.status, "AMENDED", access.permissions, data.reason);
  if (!diagnosticReportIsLocked(report.status)) {
    throw badRequest("Only finalized or delivered reports are amended");
  }
  const updated = await prisma.$transaction(async (tx) => {
    const last = await tx.diagnosticReportVersion.findFirst({
      where: { reportId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (last?.version ?? 0) + 1;
    const r = await tx.diagnosticReport.update({
      where: { id },
      data: {
        status: "AMENDED",
        ...(data.preliminaryFindings !== undefined ? { preliminaryFindings: data.preliminaryFindings } : {}),
        ...(data.specialistInterpretation !== undefined ? { specialistInterpretation: data.specialistInterpretation } : {}),
        ...(data.recommendations !== undefined ? { recommendations: data.recommendations } : {}),
      },
      select: { id: true, status: true },
    });
    await tx.diagnosticReportVersion.create({
      data: {
        reportId: id,
        version: nextVersion,
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

  return NextResponse.json({ success: true, report: updated, message: `Amended (${DIAGNOSTIC_REPORT_STATUS_LABEL.AMENDED}) — the original version is preserved in the report history` });
});
