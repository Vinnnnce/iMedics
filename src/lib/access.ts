import type { Patient, Prisma, User } from "@prisma/client";
import { prisma } from "./prisma";
import { forbidden, notFound } from "./errors";

/**
 * Clinical access policy (single place, used by every patient-data route)
 * ---------------------------------------------------------------------
 *  - DOCTOR   : only patients they have been assigned to (PatientAssignment).
 *               Reading works for any assignment; writing needs an ACTIVE one.
 *  - PATIENT  : only their own record.
 *  - LAB_SCIENTIST / ADMIN : no general access to patient records.
 *
 * Out-of-scope records are reported as "not found" so their existence is not leaked.
 */

/** The caller's doctor profile; only verified doctors may work with patient data. */
export async function getVerifiedDoctorProfile(user: User) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId: user.id } });
  if (!profile || profile.verificationStatus !== "VERIFIED") {
    throw forbidden("Your doctor account has not been verified yet");
  }
  return profile;
}

export interface PatientScope {
  /** Prisma filter selecting exactly the patients the caller may access. */
  where: Prisma.PatientWhereInput;
  /** Set for doctors: their DoctorProfile id. */
  doctorId: string | null;
}

export async function patientScope(user: User, options: { write?: boolean } = {}): Promise<PatientScope> {
  switch (user.role) {
    case "DOCTOR": {
      const doctor = await getVerifiedDoctorProfile(user);
      return {
        doctorId: doctor.id,
        where: {
          deletedAt: null,
          assignments: {
            some: { doctorId: doctor.id, ...(options.write ? { status: "ACTIVE" as const } : {}) },
          },
        },
      };
    }
    case "PATIENT":
      return { doctorId: null, where: { deletedAt: null, userId: user.id } };
    default:
      throw forbidden();
  }
}

/** Load one patient the caller may access, or throw 404. */
export async function findAccessiblePatient(
  user: User,
  patientId: string,
  options: { write?: boolean } = {},
): Promise<Patient> {
  const { where } = await patientScope(user, options);
  const patient = await prisma.patient.findFirst({ where: { AND: [{ id: patientId }, where] } });
  if (!patient) throw notFound("Patient not found");
  return patient;
}

/** The caller's lab-staff profile; only verified lab staff may submit results. */
export async function getVerifiedLabProfile(user: User) {
  const profile = await prisma.labStaffProfile.findUnique({ where: { userId: user.id } });
  if (!profile || profile.verificationStatus !== "VERIFIED") {
    throw forbidden("Your laboratory account has not been verified yet");
  }
  return profile;
}
