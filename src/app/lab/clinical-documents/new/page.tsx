import { NewDocumentForm } from "@/components/his/new-document-form";
import { requireHisPage } from "@/lib/his/page";
import { prisma } from "@/lib/prisma";

export default async function NewClinicalDocumentPage({ searchParams }: { searchParams: Promise<{ patientId?: string; encounterId?: string }> }) {
  const sp = await searchParams;
  const { facility } = await requireHisPage("AUTHOR_DOCUMENTS");
  const templates = await prisma.clinicalDocumentTemplate.findMany({ where: { facilityId: facility.id, retiredAt: null, publishedVersion: { not: null } }, orderBy: [{ groupCode: "asc" }, { name: "asc" }], select: { id: true, name: true, groupCode: true } });
  let preset = null;
  if (sp.patientId && /^[0-9a-f-]{36}$/i.test(sp.patientId)) {
    const linked = await prisma.encounter.findFirst({ where: { facilityId: facility.id, patientId: sp.patientId }, select: { patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true, dateOfBirth: true, gender: true } } } });
    if (linked) preset = { ...linked.patient, dateOfBirth: linked.patient.dateOfBirth.toISOString() };
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 md:px-0">
      <h1 className="text-2xl font-bold">New clinical document</h1>
      <NewDocumentForm templates={templates} presetPatient={preset} encounterId={sp.encounterId && /^[0-9a-f-]{36}$/i.test(sp.encounterId) ? sp.encounterId : undefined} />
    </div>
  );
}
