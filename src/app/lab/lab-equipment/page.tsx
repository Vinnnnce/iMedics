import { LabEquipmentManager } from "@/components/his/lab-equipment-manager";
import { requireHisPage } from "@/lib/his/page";

export default async function LabEquipmentPage() {
  const access = await requireHisPage("ENTER_RESULTS", ["HOSPITAL", "LABORATORY"]);
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Lab equipment, reagents & QC</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Equipment register with maintenance history, reagent lot tracking with expiry alerts, and quality control runs with pass/fail review.
        </p>
      </div>
      <LabEquipmentManager canManage={access.permissions.has("MANAGE_STAFF")} />
    </div>
  );
}
