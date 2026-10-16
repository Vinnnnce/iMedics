import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { getVerifiedLabProfile } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { ageFromDob } from "@/lib/format";
import { writeAudit } from "@/lib/audit";
import { facilityPatientWhere } from "@/lib/facility-access";

const querySchema = z.object({ caseNumber: z.string().trim().min(6).max(30) });

// GET /api/lab/patients?caseNumber= — lab staff identify a patient by exact case number.
// Returns the minimum needed to match a sample to a person, and every lookup is audited.
export const GET = withAuth(["LAB_SCIENTIST"], async (req, { user }) => {
  await getVerifiedLabProfile(user);
  const { caseNumber } = parseQuery(req, querySchema);

  const patient = await prisma.patient.findFirst({
    where: { AND: [await facilityPatientWhere(user), { caseNumber: caseNumber.toUpperCase() }] },
    select: { id: true, caseNumber: true, firstName: true, lastName: true, gender: true, dateOfBirth: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "LAB_PATIENT_LOOKUP",
    resourceType: "Patient",
    resourceId: patient?.id ?? null,
    details: { found: Boolean(patient) },
    req,
  });

  if (!patient) throw notFound("No patient with that case number");
  return NextResponse.json({
    id: patient.id,
    caseNumber: patient.caseNumber,
    name: `${patient.firstName} ${patient.lastName}`,
    gender: patient.gender.toLowerCase(),
    age: ageFromDob(patient.dateOfBirth),
  });
});
