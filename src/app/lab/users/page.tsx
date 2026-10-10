import { PatientLookup } from "@/components/lab/patient-lookup";
import { requirePageRole } from "@/lib/guards";

export default async function LabPatientLookupPage() {
  await requirePageRole("LAB_SCIENTIST");
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Patient Lookup</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confirm a patient&apos;s identity by exact case number. Every lookup is logged.</p>
      </div>
      <PatientLookup />
    </div>
  );
}
