import { LetterheadManager, type LetterheadRow } from "@/components/his/letterhead-manager";
import { requireHisPage } from "@/lib/his/page";
import { prisma } from "@/lib/prisma";

export default async function LetterheadsPage() {
  const { facility } = await requireHisPage("MANAGE_HOSPITAL_SETTINGS");
  const letterheads = await prisma.letterheadProfile.findMany({
    where: { facilityId: facility.id, active: true },
    orderBy: [{ department: "asc" }, { createdAt: "asc" }],
  });
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Letterheads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Design the official letterhead for {facility.laboratoryName ?? "this facility"}: branding, registration
          information, footers and signature blocks. Documents from a department use that department&apos;s letterhead;
          everything else uses the default.
        </p>
      </div>
      <LetterheadManager base="/api/facility/his/letterheads" facilityMode letterheads={letterheads as LetterheadRow[]} />
    </div>
  );
}
