import { notFound } from "next/navigation";
import { PrintButton } from "@/components/shared/print-button";
import { DocumentPrint } from "@/components/his/document-print";
import { requireHisPage } from "@/lib/his/page";
import { buildDocumentView, documentInclude } from "@/lib/his/documents";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";

export default async function PrintDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, facility, can } = await requireHisPage("VIEW_PATIENT_DOCUMENTS");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const doc = await prisma.clinicalDocument.findFirst({ where: { id, facilityId: facility.id }, include: documentInclude });
  if (!doc) notFound();
  if (doc.sensitivity === "SPECIALLY_PROTECTED" && doc.authorId !== user.id && !can("REVIEW_DOCUMENTS")) notFound();
  await writeAudit({ userId: user.id, actorRole: user.role, facilityId: facility.id, patientId: doc.patientId, action: "HIS_DOCUMENT_PRINT_VIEW", resourceType: "ClinicalDocument", resourceId: doc.id });
  const view = await buildDocumentView(doc);
  return (
    <div className="space-y-4 px-4 py-4 print:p-0">
      <div className="flex justify-end gap-2 print:hidden">
        <a href={`/api/facility/his/documents/${doc.id}/pdf`} className="rounded-lg border px-3 py-2 text-sm" target="_blank" rel="noreferrer">Download PDF</a>
        <PrintButton />
      </div>
      <DocumentPrint view={view} />
    </div>
  );
}
