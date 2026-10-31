import Link from "next/link";
import { requirePageRole, getPatientProfile } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { CARE_CASE_STATUS_LABELS, CARE_CASE_TYPE_LABELS } from "@/lib/cases";
import { StatusChip } from "@/components/shared/status-chip";
import { Badge } from "@/components/ui/badge";
import { groupTitle } from "@/lib/his/catalogue";
import { MEDIA_CATEGORY_LABEL } from "@/lib/his/media-formats";
import { PatientMediaDownload } from "@/components/his/patient-media-download";

/**
 * Case reports: one section per care episode with the results it produced.
 * The Documents feature (released hospital documents and diagnostic files)
 * moved inside this section as its "Documents" tab.
 */

const TABS = [
  { key: "reports", label: "Case reports" },
  { key: "documents", label: "Documents" },
] as const;

export default async function PatientCaseReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePageRole("PATIENT");
  const patient = await getPatientProfile(user.id);
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as "reports" | "documents") : "reports";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Case reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Results and reports for each of your care episodes.</p>
      </div>

      <nav className="flex gap-2" aria-label="Case report sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/patient/case-reports${t.key === "reports" ? "" : `?tab=${t.key}`}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${tab === t.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "reports" ? <CaseReports patientId={patient?.id ?? null} /> : <DocumentsTab patientId={patient?.id ?? null} />}
    </div>
  );
}

/** Results-only listing of the patient's care cases. */
async function CaseReports({ patientId }: { patientId: string | null }) {
  if (!patientId) {
    return <p className="text-sm text-muted-foreground">Your patient record is not available yet.</p>;
  }
  const cases = await prisma.careCase.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      caseNumber: true,
      type: true,
      status: true,
      createdAt: true,
      presentingComplaint: true,
      labOrders: { select: { id: true, results: { where: { status: "VERIFIED" }, select: { id: true } } } },
      consultations: { where: { status: "FINALIZED" }, select: { id: true } },
    },
  });

  if (cases.length === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="text-no-cases">No case reports yet.</p>;
  }

  return (
    <ul className="space-y-3" data-testid="list-case-reports">
      {cases.map((careCase) => {
        const verifiedResults = careCase.labOrders.reduce((sum, order) => sum + order.results.length, 0);
        return (
          <li key={careCase.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/patient/case-reports/${careCase.id}`} className="font-semibold hover:underline">
                {careCase.caseNumber}
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-lg">{CARE_CASE_TYPE_LABELS[careCase.type]}</Badge>
                <StatusChip tone={careCase.status === "CLOSED" || careCase.status === "ARCHIVED" ? "neutral" : "success"}>
                  {CARE_CASE_STATUS_LABELS[careCase.status]}
                </StatusChip>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Opened {formatDate(careCase.createdAt)}
              {careCase.presentingComplaint ? ` · ${careCase.presentingComplaint}` : ""}
              {` · ${verifiedResults} verified result${verifiedResults === 1 ? "" : "s"}`}
            </p>
            <Link href={`/patient/case-reports/${careCase.id}`} className="mt-2 inline-block text-sm text-primary hover:underline">
              View results →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The former /patient/documents page: released hospital documents and files. */
async function DocumentsTab({ patientId }: { patientId: string | null }) {
  if (!patientId) {
    return <p className="text-sm text-muted-foreground">Your patient record is not available yet.</p>;
  }
  const [documents, media] = await Promise.all([
    prisma.clinicalDocument.findMany({ take: 200,
      where: { patientId, releasedToPatientAt: { not: null }, status: { in: ["FINAL", "AMENDED"] } },
      orderBy: { finalizedAt: "desc" },
      select: { id: true, documentNumber: true, title: true, groupCode: true, status: true, finalizedAt: true, facility: { select: { laboratoryName: true } } },
    }),
    prisma.medicalMedia.findMany({ take: 200,
      where: { patientId, releasedToPatientAt: { not: null }, deletedAt: null, reportStatus: { in: ["VERIFIED", "AMENDED"] }, scanStatus: { not: "INFECTED" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, category: true, examinationType: true, examinationAt: true, fileName: true, facility: { select: { laboratoryName: true } } },
    }),
  ]);
  return (
    <>
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
    </>
  );
}
