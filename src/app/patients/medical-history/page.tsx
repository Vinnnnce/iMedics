import { redirect } from "next/navigation";

/**
 * This route used to host a static demo medical history with hardcoded data.
 * The real history lives at /patients/[patientId]/history (live database
 * records), so redirect to the patient list — the entry point for finding a
 * patient.
 */
export default function MedicalHistoryRedirect() {
  redirect("/patients");
}
