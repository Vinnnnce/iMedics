import type { Gender, Patient } from "@prisma/client";
import { calculateBMI } from "./bmi";
import type { PatientInput } from "./validations";

/** Map validated patient input onto database columns. */
export function toPatientColumns(data: PatientInput) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    middleName: data.middleName || null,
    gender: data.gender.toUpperCase() as Gender,
    dateOfBirth: new Date(data.dateOfBirth),
    height: data.height ?? null,
    weight: data.weight ?? null,
    bloodGroup: data.bloodGroup || null,
    genotype: data.genotype || null,
    occupation: data.occupation || null,
    addressLine1: data.addressLine1 || null,
    addressLine2: data.addressLine2 || null,
    city: data.city || null,
    state: data.state || null,
    postalCode: data.postalCode || null,
    country: data.country || null,
    ecName: data.ecName || null,
    ecRelationship: data.ecRelationship || null,
    ecPhone: data.ecPhone || null,
    ecAddress: data.ecAddress || null,
  };
}

/** API shape for a patient: lowercase gender (as the UI expects) and a derived BMI. */
export function serializePatient<T extends Patient>(patient: T) {
  return {
    ...patient,
    gender: patient.gender.toLowerCase(),
    bmi: calculateBMI(patient.height, patient.weight)?.value ?? null,
  };
}
