import { redirect } from "next/navigation";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { permissionsForRole } from "@/lib/facility-staff";
import { prisma } from "@/lib/prisma";
import { FacilityDocumentsTable } from "@/components/lab/facility-documents-table";
import { listFacilityDocuments } from "@/lib/facility-documents";

export default async function FacilityDocumentsPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);

  // VIEW_PATIENT_DOCUMENTS is required to read the facility's issued documents.
  const memberships = await prisma.facilityStaff.findMany({
    where: { userId: user.id, facilityId: profile.id, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: { facilityRole: true },
  });
  const canView = memberships.some(m => permissionsForRole(m.facilityRole).includes("VIEW_PATIENT_DOCUMENTS"));
  if (!canView) redirect("/lab/dashboard");

  const { documents, nextCursor } = await listFacilityDocuments({ facilityId: profile.id });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Patient documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Documents your facility issued, and documents patients have chosen to share with you. Downloads are audited.
        </p>
      </div>
      <FacilityDocumentsTable initialDocuments={documents} initialCursor={nextCursor} />
    </div>
  );
}
