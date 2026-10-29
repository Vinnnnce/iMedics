import { redirect } from "next/navigation";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { permissionsForRole } from "@/lib/facility-staff";
import { prisma } from "@/lib/prisma";
import { FacilityDocumentsTable } from "@/components/lab/facility-documents-table";

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

  const documents = await prisma.patientDocument.findMany({
    where: { issuingFacilityId: profile.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, category: true, title: true, issuedOn: true, notes: true, createdAt: true,
      patient: { select: { firstName: true, lastName: true, caseNumber: true } },
      uploader: { select: { name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Patient documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Documents your facility has issued to its patients. Downloads are audited.
        </p>
      </div>
      <FacilityDocumentsTable
        documents={documents.map(d => ({
          id: d.id,
          category: d.category,
          title: d.title,
          issuedOn: d.issuedOn?.toISOString() ?? null,
          notes: d.notes,
          createdAt: d.createdAt.toISOString(),
          patient: {
            name: `${d.patient.firstName} ${d.patient.lastName}`,
            caseNumber: d.patient.caseNumber,
          },
          uploadedBy: d.uploader.name,
        }))}
      />
    </div>
  );
}
