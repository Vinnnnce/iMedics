import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications/service";

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/facility/diagnostic-referrals — the hospital's outbound diagnostic
// referrals and their examination status (Module 01, Category 04).
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const { limit } = parseQuery(req, listSchema);

  const referrals = await prisma.facilityBooking.findMany({
    where: { requestingFacilityId: access.facility.id },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      status: true,
      preferredAt: true,
      workflowStage: true,
      createdAt: true,
      serviceName: true,
      patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true } },
      service: { select: { facility: { select: { id: true, laboratoryName: true } } } },
      diagnosticReport: { select: { id: true, status: true, sentAt: true } },
    },
  });

  return NextResponse.json({ referrals });
});

const createSchema = z.object({
  patientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  preferredAt: z.coerce.date(),
  clinicalIndication: z.string().trim().max(2000).optional(),
});

// POST /api/facility/diagnostic-referrals — a hospital refers a patient to a
// diagnostic centre (shared workflow step 2-3). Creates a booking owned by
// the diagnostic centre and tracked by the requesting hospital.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const data = await parseBody(req, createSchema);

  const patient = await prisma.patient.findFirst({
    where: { id: data.patientId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) throw badRequest("Patient not found");

  const service = await prisma.facilityService.findFirst({
    where: { id: data.serviceId, isActive: true, facility: { verificationStatus: "VERIFIED" } },
    select: { id: true, name: true, price: true, currency: true, facility: { select: { id: true, kind: true, user: { select: { id: true } } } } },
  });
  if (!service) throw badRequest("The selected examination service was not found or is not available");
  if (service.facility.kind && service.facility.kind !== "DIAGNOSTIC_CENTRE") {
    throw badRequest("The selected facility is not a diagnostic centre");
  }

  let careCaseId: string | null = null;
  const careCase = await prisma.careCase.findFirst({
    where: { patientId: data.patientId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  careCaseId = careCase?.id ?? null;

  const booking = await prisma.facilityBooking.create({
    data: {
      patientId: data.patientId,
      serviceId: service.id,
      serviceName: service.name,
      amount: service.price,
      currency: service.currency,
      preferredAt: data.preferredAt,
      status: "REQUESTED",
      requestingFacilityId: access.facility.id,
      caseId: careCaseId,
    },
    select: { id: true, status: true },
  });

  // The clinical indication travels with the referral in the patient's care
  // timeline (minimum necessary context for the diagnostic centre).
  if (data.clinicalIndication && careCaseId) {
    await prisma.careCaseEvent.create({
      data: {
        caseId: careCaseId,
        status: "AWAITING_RESULT",
        note: `Diagnostic referral (${service.name}): ${data.clinicalIndication}`,
        actorId: user.id,
      },
    }).catch(() => undefined);
  }

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "DIAGNOSTIC_REFERRAL_CREATED",
    resourceType: "FacilityBooking",
    resourceId: booking.id,
    details: {
      requestingFacilityId: access.facility.id,
      serviceId: service.id,
      toFacilityId: service.facility.id,
    },
    req,
  });

  if (service.facility.user?.id) {
    await notifyUser(service.facility.user.id, { kind: "INVESTIGATION_UPDATED", orderId: booking.id }).catch(() => undefined);
  }

  return NextResponse.json({ success: true, id: booking.id, booking }, { status: 201 });
});
