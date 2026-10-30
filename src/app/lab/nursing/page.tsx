import { NursingDashboard } from "@/components/his/nursing-dashboard";
import { requireHisPage } from "@/lib/his/page";

export default async function NursingPage() {
  const { can } = await requireHisPage("VIEW_PATIENT_DOCUMENTS", ["HOSPITAL"]);
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Nursing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record observations with their clinical timestamp and unit, manage care tasks (due, in progress, completed, deferred, escalated) and hand over open items between shifts. Values are never automatically interpreted or flagged.
        </p>
      </div>
      <NursingDashboard canRecord={can("RECORD_NURSING")} />
    </div>
  );
}
