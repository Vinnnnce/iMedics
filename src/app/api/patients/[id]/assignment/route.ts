import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ status: z.enum(["ACTIVE", "DISCHARGED"]) });

// PATCH /api/patients/[id]/assignment — a doctor discharges or re-admits a patient in their own care.
export const PATCH = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const patientId = parseId((await params).id);
  const { status } = await parseBody(req, schema);
  const doctor = await getVerifiedDoctorProfile(user);

  // Updating through the composite key means a doctor can only touch their own assignment (404 otherwise).
  const assignment = await prisma.patientAssignment.update({
    where: { patientId_doctorId: { patientId, doctorId: doctor.id } },
    data: status === "DISCHARGED" ? { status, dischargedAt: new Date() } : { status, dischargedAt: null },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: status === "DISCHARGED" ? "PATIENT_DISCHARGED" : "PATIENT_READMITTED",
    resourceType: "Patient",
    resourceId: patientId,
    req,
  });

  return NextResponse.json({ success: true, assignment });
});
