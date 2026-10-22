import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind, MINIMUM_PATIENT_SELECT } from "@/lib/modules/access-matrix";
import { conflict, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const listSchema = z.object({
  status: z.enum(["DRAFT", "AWAITING_VERIFICATION", "FINALIZED", "SENT", "AMENDED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/facility/diagnostic-reports — the diagnostic centre's report work
// queue (Module 03, Category 04). Minimum patient data only.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "ENTER_RESULTS", req);
  await requireFacilityKind(access, ["DIAGNOSTIC_CENTRE"]);
  const { status, limit } = parseQuery(req, listSchema);

  const reports = await prisma.diagnosticReport.findMany({
    where: { facilityId: access.facility.id, ...(status ? { status } : {}) },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      bookingId: true,
      status: true,
      updatedAt: true,
      finalizedAt: true,
      sentAt: true,
      preliminaryFindings: true,
      specialistInterpretation: true,
      recommendations: true,
      booking: {
        select: {
          id: true,
          workflowStage: true,
          preferredAt: true,
          service: { select: { id: true, name: true, category: true } },
          patient: { select: MINIMUM_PATIENT_SELECT },
        },
      },
      versions: { select: { id: true, version: true, reason: true, createdAt: true } },
    },
  });

  return NextResponse.json({ reports });
});

const createSchema = z.object({
  bookingId: z.string().uuid(),
  preliminaryFindings: z.string().trim().max(20000).optional(),
  specialistInterpretation: z.string().trim().max(20000).optional(),
  recommendations: z.string().trim().max(10000).optional(),
});

// POST /api/facility/diagnostic-reports — create a draft examination report
// for one of the centre's bookings (Module 03, Category 04).
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "ENTER_RESULTS", req);
  await requireFacilityKind(access, ["DIAGNOSTIC_CENTRE"]);
  const data = await parseBody(req, createSchema);

  const booking = await prisma.facilityBooking.findFirst({
    where: { id: data.bookingId, service: { facilityId: access.facility.id } },
    select: { id: true, status: true },
  });
  if (!booking) throw notFound("Examination booking not found");
  if (booking.status === "CANCELLED") throw conflict("This booking was cancelled");

  const existing = await prisma.diagnosticReport.findUnique({
    where: { bookingId: data.bookingId },
    select: { id: true },
  });
  if (existing) throw conflict("A report already exists for this examination");

  const report = await prisma.diagnosticReport.create({
    data: {
      bookingId: data.bookingId,
      facilityId: access.facility.id,
      draftedById: user.id,
      status: "DRAFT",
      preliminaryFindings: data.preliminaryFindings ?? null,
      specialistInterpretation: data.specialistInterpretation ?? null,
      recommendations: data.recommendations ?? null,
    },
    select: { id: true, status: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "DIAGNOSTIC_REPORT_DRAFTED",
    resourceType: "DiagnosticReport",
    resourceId: report.id,
    details: { bookingId: data.bookingId },
    req,
  });

  return NextResponse.json({ success: true, id: report.id, report }, { status: 201 });
});
