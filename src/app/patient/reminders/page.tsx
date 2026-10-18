import { requirePageRole } from "@/lib/guards";
import { PatientReminders } from "@/components/patient/reminders";

export default async function PatientRemindersPage() {
  await requirePageRole("PATIENT");
  return <PatientReminders />;
}
