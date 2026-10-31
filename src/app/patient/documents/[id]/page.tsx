import { notFound } from "next/navigation";
import { PrintButton } from "@/components/shared/print-button";
import { DocumentPrint } from "@/components/his/document-print";
import { requirePageRole, getPatientProfile } from "@/lib/guards";
import { buildDocumentView, documentInclude } from "@/lib/his/documents";
import { visibleToPatient } from "@/lib/his/workflow";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export default async function PatientDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole("PATIENT");
  const patient = await getPatientProfile(user.id);
  if (!patient || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const doc = await prisma.clinicalDocument.findFirst({ where: { id, patientId: patient.id }, include: documentInclude });
  if (!doc || !visibleToPatient(doc)) notFound();
  await writeAudit({ userId: user.id, actorRole: user.role, patientId: patient.id, facilityId: doc.facilityId, action: "PATIENT_DOCUMENT_VIEWED", resourceType: "ClinicalDocument", resourceId: doc.id });
  const view = await buildDocumentView(doc);
  return (
    <div className="space-y-4 px-4 py-4 print:p-0">
      <div className="flex justify-end gap-2 print:hidden">
        <a href={`/api/patient/clinical-documents/${doc.id}/pdf`} className="rounded-lg border px-3 py-2 text-sm" target="_blank" rel="noreferrer">Download PDF</a>
        <PrintButton />
      </div>
      <DocumentPrint view={view} />
    </div>
  );
}
