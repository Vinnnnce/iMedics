import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getVerifiedDoctorProfile, patientScope } from "@/lib/access";
import { consultationInclude } from "@/lib/consultation";
import { notFound } from "@/lib/errors";

/**
 * Loads a consultation the caller may read:
 *  - doctors: reports they wrote, or reports for patients currently in their care
 *  - patients: their own finalized reports
 * Throws 404 otherwise, so the existence of other people's reports is never revealed.
 */
export async function findViewableConsultation(user: User, id: string) {
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
  return consultation;
}
