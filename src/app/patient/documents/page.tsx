import Link from "next/link";
import { requirePageRole, getPatientProfile } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { groupTitle } from "@/lib/his/catalogue";
import { MEDIA_CATEGORY_LABEL } from "@/lib/his/media-formats";
import { PatientMediaDownload } from "@/components/his/patient-media-download";

// Released clinical documents and diagnostic files from hospitals. Drafts,
// preliminary and unreleased records never appear here.
export default async function PatientDocumentsPage() {
  const user = await requirePageRole("PATIENT");
  const patient = await getPatientProfile(user.id);
  const [documents, media] = patient
    ? await Promise.all([
        prisma.clinicalDocument.findMany({
          where: { patientId: patient.id, releasedToPatientAt: { not: null }, status: { in: ["FINAL", "AMENDED"] } },
          orderBy: { finalizedAt: "desc" },
          select: { id: true, documentNumber: true, title: true, groupCode: true, status: true, finalizedAt: true, facility: { select: { laboratoryName: true } } },
        }),
        prisma.medicalMedia.findMany({
          where: { patientId: patient.id, releasedToPatientAt: { not: null }, deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, category: true, examinationType: true, examinationAt: true, fileName: true, facility: { select: { laboratoryName: true } } },
        }),
      ])
    : [[], []];
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Hospital documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">Reports and files your care teams have finalized and released to you.</p>
      </div>
      <section aria-labelledby="docs-h">
        <h2 id="docs-h" className="text-sm font-semibold">Documents</h2>
        {documents.length === 0 ? <p className="mt-2 text-sm text-muted-foreground" data-testid="text-no-documents">No documents have been released yet.</p> : (
          <ul className="mt-2 divide-y rounded-xl border bg-card">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <Link href={`/patient/documents/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                  <p className="text-xs text-muted-foreground">{groupTitle(d.groupCode)} · {d.facility.laboratoryName ?? "Hospital"} · {d.finalizedAt ? formatDate(d.finalizedAt) : ""} · {d.documentNumber}{d.status === "AMENDED" ? " · superseded by a correction" : ""}</p>
                </div>
                <a href={`/api/patient/clinical-documents/${d.id}/pdf`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Download PDF</a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="media-h">
        <h2 id="media-h" className="text-sm font-semibold">Diagnostic files</h2>
        {media.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No files have been released yet.</p> : (
          <ul className="mt-2 divide-y rounded-xl border bg-card">
            {media.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">{m.examinationType}</p>
                  <p className="text-xs text-muted-foreground">{MEDIA_CATEGORY_LABEL[m.category]} · {m.facility.laboratoryName ?? "Hospital"}{m.examinationAt ? ` · ${formatDate(m.examinationAt)}` : ""} · {m.fileName}</p>
                </div>
                <PatientMediaDownload id={m.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
