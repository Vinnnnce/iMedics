import { redirect } from "next/navigation";

/**
 * This route used to host a static demo profile with hardcoded data. The real
 * patient profile lives at /patients/[patientId] (live database records), so
 * redirect there — the patient list is the entry point for finding a patient.
 */
export default function PatientProfileRedirect() {
  redirect("/patients");
}
