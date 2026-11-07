import { EncounterBoard } from "@/components/his/encounter-board";
import { requireHisPage } from "@/lib/his/page";
import { BOARDS } from "@/lib/his/encounters";
import { prisma } from "@/lib/prisma";

export default async function EncountersPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const sp = await searchParams;
  const { facility } = await requireHisPage("MANAGE_ENCOUNTERS", ["HOSPITAL"]);
  const settings = await prisma.hospitalSettings.findUnique({ where: { facilityId: facility.id }, select: { triageCategories: true, triageProtocol: true } });
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Encounters &amp; queues</h1>
        <p className="mt-1 text-sm text-muted-foreground">Emergency, urgent, planned, elective, inpatient, outpatient and waiting-list dashboards. Refreshes every minute.</p>
      </div>
      <EncounterBoard initialBoard={(BOARDS as readonly string[]).includes(sp.board ?? "") ? sp.board! : "all"} triageCategories={settings?.triageProtocol ? settings.triageCategories : []} triageProtocol={settings?.triageProtocol ?? null} />
    </div>
  );
}
