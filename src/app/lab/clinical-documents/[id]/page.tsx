import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentEditor } from "@/components/his/document-editor";
import { requireHisPage } from "@/lib/his/page";
import { buildDocumentView, documentInclude } from "@/lib/his/documents";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { mediaVisibility } from "@/lib/his/visibility";

export default async function ClinicalDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, facility, can } = await requireHisPage("VIEW_PATIENT_DOCUMENTS");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const doc = await prisma.clinicalDocument.findFirst({ where: { id, facilityId: facility.id }, include: documentInclude });
  if (!doc) notFound();
  if (doc.sensitivity === "SPECIALLY_PROTECTED" && doc.authorId !== user.id && !can("REVIEW_DOCUMENTS")) {
    return <p className="p-6 text-sm">This record is specially protected. Access is limited to its author and reviewing clinicians.</p>;
  }
  await writeAudit({ userId: user.id, actorRole: user.role, facilityId: facility.id, patientId: doc.patientId, action: "HIS_DOCUMENT_VIEWED", resourceType: "ClinicalDocument", resourceId: doc.id });
  const view = await buildDocumentView(doc);
  const mediaOptions = await prisma.medicalMedia.findMany({
    where: { facilityId: facility.id, patientId: doc.patientId, deletedAt: null, scanStatus: { not: "INFECTED" }, ...mediaVisibility(can("REVIEW_DOCUMENTS")) },
    select: { id: true, fileName: true, mimeType: true, sensitivity: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 md:px-0">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground"><Link href="/lab/clinical-documents" className="hover:underline">Medical documents</Link> / <Link href={`/lab/patients/${view.patient.id}`} className="hover:underline">{view.patient.name}</Link> / {view.documentNumber}</nav>
      <div>
        <h1 className="text-2xl font-bold">{view.title}</h1>
        <p className="text-sm text-muted-foreground">{view.documentNumber} · rev {view.revision} · {view.groupTitle} · {view.patient.name} ({view.patient.caseNumber}) · author {view.author.name}{view.releasedToPatientAt ? " · released to patient" : ""}</p>
      </div>
      <DocumentEditor key={doc.id} view={view} mediaOptions={mediaOptions} isAuthor={doc.authorId === user.id} perms={{ author: can("AUTHOR_DOCUMENTS"), review: can("REVIEW_DOCUMENTS"), sign: can("SIGN_DOCUMENTS"), approve: can("APPROVE_DOCUMENTS"), release: can("RELEASE_DOCUMENTS") }} />
    </div>
  );
}
