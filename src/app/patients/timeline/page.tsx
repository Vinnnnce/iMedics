import { redirect } from "next/navigation";

/**
 * This route used to host a static demo timeline with hardcoded data. The real
 * patient record is the unified case file at
 * /patients/[patientId]/case-file (live database records), so redirect to the
 * patient list — the entry point for finding a patient.
 */
export default function PatientTimelineRedirect() {
  redirect("/patients");
}
