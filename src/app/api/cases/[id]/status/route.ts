import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { patientScope } from "@/lib/access";
import { notFound, forbidden } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { careCaseTransitionsFrom, transitionCareCase } from "@/lib/cases";
import type { CareCaseStatus } from "@prisma/client";

const transitionSchema = z.object({
  status: z.enum([
    "OPEN",
    "AWAITING_CONSULTATION",
    "AWAITING_INVESTIGATION",
    "AWAITING_RESULT",
    "RESULT_AVAILABLE",
    "UNDER_REVIEW",
    "TREATMENT_ONGOING",
    "FOLLOW_UP_REQUIRED",
    "CLOSED",
    "ARCHIVED",
  ]),
  note: z.string().trim().max(2000).optional(),
});

// POST /api/cases/[id]/status — records a care-status transition.
// Doctors may only transition cases of patients in their care; admins may
// transition any case. Patients never change case status: their actions
// (payments, uploads, messages) are clinical-workflow inputs, not verdicts.
// Every transition is validated against the transition table and appended to
// the case's status history.
export const POST = withAuth<{ id: string }>(["DOCTOR", "ADMIN"], async (req, { user, params }) => {
  const data = await parseBody(req, transitionSchema);
  const caseId = parseId((await params).id);

  const careCase = await prisma.careCase.findUnique({
    where: { id: caseId },
    select: { id: true, patientId: true, caseNumber: true, status: true },
  });
  if (!careCase) throw notFound("Case not found");

  if (user.role === "DOCTOR") {
    // Status changes are mutations: require the doctor's write scope, not just
    // read access to the patient.
    const scope = await patientScope(user, { write: true });
    const accessible = await prisma.patient.findFirst({
      where: { AND: [{ id: careCase.patientId }, scope.where] },
      select: { id: true },
    });
    if (!accessible) throw forbidden("This case belongs to a patient not in your care");
  }

  await transitionCareCase(caseId, data.status as CareCaseStatus, user.id, data.note ?? null);

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "CARE_CASE_STATUS_CHANGED",
    resourceType: "CareCase",
    resourceId: careCase.id,
    details: { caseNumber: careCase.caseNumber, from: careCase.status, to: data.status },
    req,
  });

  const updated = await prisma.careCase.findUnique({
    where: { id: careCase.id },
    select: { id: true, caseNumber: true, status: true },
  });

  return NextResponse.json({
    success: true,
    case: updated,
    allowedTransitions: careCaseTransitionsFrom(data.status as CareCaseStatus),
  });
});
