import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { assertAdmissionDischarge } from "@/lib/modules/workflows";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const dischargeSchema = z.object({
  dischargeDate: z.coerce.date(),
  disposition: z.enum(["RECOVERED", "IMPROVED", "UNCHANGED", "WORSE", "DECEASED", "REFERRED"]),
  finalDiagnosisCode: z.string().trim().max(20).optional(),
  finalDiagnosisName: z.string().trim().max(300).optional(),
  outcome: z.string().trim().max(1000).optional(),
  // The discharge epicrisis is mandatory (Module 01, Category 05).
  epicrisis: z.string().trim().min(1).max(20000),
  medicationInstructions: z.string().trim().max(5000).optional(),
  followUpInstructions: z.string().trim().max(5000).optional(),
});

// POST /api/facility/admissions/[id]/discharge — close the episode with a
// discharge summary / epicrisis (Module 01, Category 05).
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const data = await parseBody(req, dischargeSchema);

  const admission = await prisma.admission.findFirst({
    where: { id, facilityId: access.facility.id },
    select: { id: true, status: true, patientId: true },
  });
  if (!admission) throw notFound("Admission not found");

  assertAdmissionDischarge(admission.status, data.epicrisis);

  const updated = await prisma.admission.update({
    where: { id },
    data: {
      status: "DISCHARGED",
      dischargeDate: data.dischargeDate,
      disposition: data.disposition,
      finalDiagnosisCode: data.finalDiagnosisCode ?? null,
      finalDiagnosisName: data.finalDiagnosisName ?? null,
      outcome: data.outcome ?? null,
      epicrisis: data.epicrisis,
      medicationInstructions: data.medicationInstructions ?? null,
      followUpInstructions: data.followUpInstructions ?? null,
      dischargedById: user.id,
      dischargedAt: new Date(),
    },
    select: { id: true, status: true, dischargeDate: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "ADMISSION_DISCHARGED",
    resourceType: "Admission",
    resourceId: id,
    details: { disposition: data.disposition },
    req,
  });

  // The discharge record itself is immutable once issued; corrections go
  // through the audited reason parameter (see PATCH on the admission).
  return NextResponse.json({ success: true, admission: updated });
});
