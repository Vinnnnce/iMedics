import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { queueNotification } from "@/lib/notifications/service";

const sendSchema = z.object({
  facilityId: z.string().uuid(),
  patientId: z.string().uuid(),
  caseId: z.string().uuid().nullish(),
  serviceId: z.string().uuid().nullish(),
  note: z.string().trim().max(1000).nullish(),
});

// POST /api/referrals — a doctor refers a patient to a facility for a service.
// The referral lands in the facility's referral inbox and notifies its owner.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const input = await parseBody(req, sendSchema);

  const doctor = await prisma.doctorProfile.findFirst({ where: { userId: user.id }, select: { id: true } });
  if (!doctor) throw notFound("Doctor profile not found");

  const facility = await prisma.labStaffProfile.findFirst({
    where: { id: input.facilityId, verificationStatus: "VERIFIED", user: { status: "ACTIVE", deletedAt: null } },
    select: { id: true, userId: true, laboratoryName: true },
  });
  if (!facility) throw notFound("Facility not found");

  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, deletedAt: null },
    select: { id: true, caseNumber: true, firstName: true, lastName: true },
  });
  if (!patient) throw notFound("Patient not found");

  let service = null;
  if (input.serviceId) {
    service = await prisma.facilityService.findFirst({
      where: { id: input.serviceId, facilityId: facility.id, isActive: true },
      select: { id: true, name: true },
    });
    if (!service) throw notFound("Service not found for that facility");
  }

  const referral = await prisma.facilityReferral.create({
    data: {
      facilityId: facility.id,
      fromDoctorId: doctor.id,
      patientId: patient.id,
      caseId: input.caseId ?? null,
      serviceId: service?.id ?? null,
      note: input.note ?? null,
      status: "PENDING",
    },
    select: { id: true, status: true, createdAt: true },
  });

  await queueNotification(facility.userId, { kind: "FACILITY_REFERRAL_RECEIVED", referralId: referral.id });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "FACILITY_REFERRAL_SENT",
    resourceType: "FacilityReferral", resourceId: referral.id,
    details: { facilityId: facility.id, patientId: patient.id }, patientId: patient.id, req,
  });

  return NextResponse.json({ referral }, { status: 201 });
});
