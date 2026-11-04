import { WardManager } from "@/components/his/ward-manager";
import { requireHisPage } from "@/lib/his/page";

export default async function WardsPage() {
  await requireHisPage("MANAGE_ENCOUNTERS", ["HOSPITAL"]);
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Wards & beds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ward configuration, bed inventory, occupancy, reservations, cleaning and isolation status. Refreshes every minute.
        </p>
      </div>
      <WardManager />
    </div>
  );
}
