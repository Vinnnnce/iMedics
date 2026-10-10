import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { getVerifiedDoctorProfile, patientScope } from "@/lib/access";
import { consultationInclude, serializeConsultation } from "@/lib/consultation";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

// GET /api/consultations/[id]
//  - doctors: reports they wrote, or reports for patients currently in their care
//  - patients: their own finalized reports
export const GET = withAuth<{ id: string }>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);

  let access: Prisma.ConsultationWhereInput;
  if (user.role === "DOCTOR") {
    const doctor = await getVerifiedDoctorProfile(user);
    const scope = await patientScope(user);
    access = { OR: [{ doctorId: doctor.id }, { patient: scope.where }] };
  } else {
    access = { status: "FINALIZED", patient: { userId: user.id, deletedAt: null } };
  }

  const consultation = await prisma.consultation.findFirst({
    where: { AND: [{ id }, access] },
    include: consultationInclude,
  });
  if (!consultation) throw notFound("Consultation not found");

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "CONSULTATION_VIEWED",
    resourceType: "Consultation",
    resourceId: id,
    req,
  });

  return NextResponse.json({ consultation: serializeConsultation(consultation) });
});
