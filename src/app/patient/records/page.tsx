import { requirePageRole } from "@/lib/guards";
import { PatientRecords } from "@/components/patient/records";

export default async function PatientRecordsPage() {
  await requirePageRole("PATIENT");
  return <PatientRecords />;
}
