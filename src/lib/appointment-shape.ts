import type { Prisma } from "@prisma/client";

export const appointmentInclude = {
  patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } },
  doctor: { select: { id: true, specialty: true, user: { select: { name: true } } } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

/** API shape: flat patient / doctor summaries. */
export function serializeAppointment(appointment: AppointmentWithRelations) {
  const { patient, doctor, ...rest } = appointment;
  return {
    ...rest,
    patient: { id: patient.id, name: `${patient.firstName} ${patient.lastName}`, caseNumber: patient.caseNumber },
    doctor: { id: doctor.id, name: doctor.user.name, specialty: doctor.specialty },
  };
}
