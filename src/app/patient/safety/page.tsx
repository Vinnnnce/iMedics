import { requirePageRole } from "@/lib/guards";
import { PatientSafety } from "@/components/patient/safety";

export default async function PatientSafetyPage() {
  await requirePageRole("PATIENT");
  return <PatientSafety />;
}
