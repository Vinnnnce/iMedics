import type { Prisma } from "@prisma/client";

export const consultationInclude = {
  case: { select: { id: true, caseNumber: true } },
  patient: {
    select: { id: true, firstName: true, lastName: true, caseNumber: true, dateOfBirth: true, gender: true },
  },
  doctor: { select: { id: true, user: { select: { name: true } } } },
  prescriptions: { include: { items: true } },
  diagnoses: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }], select: { code: true, description: true, isPrimary: true } },
} satisfies Prisma.ConsultationInclude;

export type ConsultationWithRelations = Prisma.ConsultationGetPayload<{ include: typeof consultationInclude }>;

/** API shape for a consultation: flat patient/doctor names and lowercase status, as the UI expects. */
export function serializeConsultation(consultation: ConsultationWithRelations) {
  const { patient, doctor, case: careCase, ...rest } = consultation;
  return {
    ...rest,
    status: consultation.status.toLowerCase(),
    case: careCase ? { id: careCase.id, caseNumber: careCase.caseNumber } : null,
    patient: {
      id: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      caseNumber: patient.caseNumber,
      dateOfBirth: patient.dateOfBirth,
      sex: patient.gender.toLowerCase(),
    },
    doctor: { id: doctor.id, name: doctor.user.name },
  };
}
