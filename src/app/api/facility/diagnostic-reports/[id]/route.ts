import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { diagnosticReportIsLocked, DIAGNOSTIC_REPORT_STATUS_LABEL } from "@/lib/modules/workflows";
import { badRequest, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

// GET /api/facility/diagnostic-reports/[id] — report detail with versions.
// The owning diagnostic centre sees everything; the requesting hospital can
// read a report once it has been sent to them (Module 03, Category 05).
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);

  const labAccess = await requireFacilityAccess(user, "ENTER_RESULTS", req).catch(() => null);
  if (labAccess && labAccess.facility.kind === "DIAGNOSTIC_CENTRE") {
    const report = await prisma.diagnosticReport.findFirst({
      where: { id, facilityId: labAccess.facility.id },
      select: REPORT_SELECT });
    if (report) return NextResponse.json({ report, role: "owner" });
  }

  // Requesting hospital: read-only access to reports sent to (or created for)
  // them. They cannot act on the report — actions stay diagnostic-only.
  const hospitalAccess = labAccess ?? await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  const report = await prisma.diagnosticReport.findFirst({
    where: {
      id,
      OR: [
        { sentToFacilityId: hospitalAccess.facility.id },
        { booking: { requestingFacilityId: hospitalAccess.facility.id } },
        { booking: { service: { facilityId: hospitalAccess.facility.id } } },
      ],
    },
    select: REPORT_SELECT,
  });
  if (!report) throw notFound("Diagnostic report not found");
  return NextResponse.json({ report, role: "recipient" });
});

const REPORT_SELECT = {
      id: true, bookingId: true, status: true,
      preliminaryFindings: true, specialistInterpretation: true, recommendations: true,
      draftedById: true, verifiedById: true, verifiedAt: true, signedById: true, signedAt: true,
      finalizedAt: true, sentAt: true, sentToFacilityId: true, createdAt: true, updatedAt: true,
      booking: {
        select: {
          id: true, workflowStage: true, preferredAt: true,
          service: { select: { id: true, name: true, category: true } },
          patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true, dateOfBirth: true, gender: true } },
        },
      },
      versions: {
        orderBy: { version: "desc" },
        select: { id: true, version: true, reason: true, changedById: true, createdAt: true, changedBy: { select: { name: true } } },
      },
      images: {
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true, storageKey: true },
      },
} satisfies Prisma.DiagnosticReportSelect;

const patchSchema = z.object({
  preliminaryFindings: z.string().trim().max(20000).optional(),
  specialistInterpretation: z.string().trim().max(20000).optional(),
  recommendations: z.string().trim().max(10000).optional(),
});

// PATCH /api/facility/diagnostic-reports/[id] — edit a DRAFT report.
// Finalized and sent reports are immutable (see the amendment action).
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "ENTER_RESULTS", req);
  await requireFacilityKind(access, ["DIAGNOSTIC_CENTRE"]);
  const id = parseId((await params).id);
  const data = await parseBody(req, patchSchema);

  const report = await prisma.diagnosticReport.findFirst({
    where: { id, facilityId: access.facility.id },
    select: { id: true, status: true },
  });
  if (!report) throw notFound("Diagnostic report not found");

  if (diagnosticReportIsLocked(report.status)) {
    throw badRequest(
      `A ${DIAGNOSTIC_REPORT_STATUS_LABEL[report.status].toLowerCase()} report cannot be edited — use the amendment process`,
    );
  }

  const updated = await prisma.diagnosticReport.update({
    where: { id },
    data: {
      ...(data.preliminaryFindings !== undefined ? { preliminaryFindings: data.preliminaryFindings } : {}),
      ...(data.specialistInterpretation !== undefined ? { specialistInterpretation: data.specialistInterpretation } : {}),
      ...(data.recommendations !== undefined ? { recommendations: data.recommendations } : {}),
    },
    select: { id: true, status: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "DIAGNOSTIC_REPORT_EDITED",
    resourceType: "DiagnosticReport",
    resourceId: id,
    details: { fields: Object.keys(data), status: report.status },
    req,
  });

  return NextResponse.json({ success: true, report: updated });
});
