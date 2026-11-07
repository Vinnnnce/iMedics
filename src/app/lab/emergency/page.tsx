import { EmergencyDepartment } from "@/components/his/emergency-department";
import { requireHisPage } from "@/lib/his/page";
import { prisma } from "@/lib/prisma";

export default async function EmergencyPage() {
  const { facility } = await requireHisPage("MANAGE_ENCOUNTERS", ["HOSPITAL"]);
  const settings = await prisma.hospitalSettings.findUnique({
    where: { facilityId: facility.id },
    select: { triageCategories: true, triageProtocol: true },
  });
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Emergency department</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live emergency board: registrations, triage, critical alerts, bed availability and unidentified-patient reconciliation. Refreshes every 30 seconds.
        </p>
      </div>
      <EmergencyDepartment
        triageCategories={settings?.triageProtocol ? settings.triageCategories : []}
        triageProtocol={settings?.triageProtocol ?? null}
      />
    </div>
  );
}
