import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const querySchema = z.object({ caseNumber: z.string().trim().min(6).max(30) });

// GET /api/facility/patients?caseNumber= — a hospital identifies a patient by
// exact case number (Module 01, Category 01). Returns the minimum data needed
// and every lookup is audited.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const { caseNumber } = parseQuery(req, querySchema);

  const patient = await prisma.patient.findFirst({
    where: { caseNumber: caseNumber.toUpperCase(), deletedAt: null },
    select: { id: true, caseNumber: true, firstName: true, lastName: true, gender: true, dateOfBirth: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "FACILITY_PATIENT_LOOKUP",
    resourceType: "Patient",
    resourceId: patient?.id ?? null,
    details: { facilityId: access.facility.id, found: Boolean(patient) },
    req,
  });

  if (!patient) throw notFound("No patient with that case number");
  return NextResponse.json({
    patient: {
      id: patient.id,
      caseNumber: patient.caseNumber,
      firstName: patient.firstName,
      lastName: patient.lastName,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth,
    },
  });
});
