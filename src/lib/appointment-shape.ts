import type { Prisma } from "@prisma/client";

export const appointmentInclude = {
  patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } },
  doctor: { select: { id: true, specialty: true, user: { select: { name: true } } } },
  payment: { select: { id: true, status: true, amount: true, currency: true, expiresAt: true, receiptNumber: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

/** API shape: flat patient / doctor summaries. */
export function serializeAppointment(appointment: AppointmentWithRelations) {
  const { patient, doctor, payment, feeAmount, ...rest } = appointment;
  return {
    ...rest,
    fee: { kind: appointment.feeKind, amount: Number(feeAmount), currency: appointment.feeCurrency },
    payment: payment && { ...payment, amount: Number(payment.amount) },
    patient: { id: patient.id, name: `${patient.firstName} ${patient.lastName}`, caseNumber: patient.caseNumber },
    doctor: { id: doctor.id, name: doctor.user.name, specialty: doctor.specialty },
  };
}
